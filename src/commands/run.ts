import chalk from "chalk";
import ora from "ora";

import { makeSolanaContext } from "../solana/makeAgent";
import { takeSnapshot, formatSnapshotSummary } from "../state/snapshot";
import { evaluateRisk } from "../risk/risk.engine";
import { formatRiskReport } from "../risk/risk.format";
import { generatePlan } from "../planner/plan.llm";
import { checkPlanAgainstPolicy } from "../policy/policy.plan.bridge";
import { formatPlanBundle } from "../planner/plan.format";
import { savePlan, loadPlan } from "../planner/plan.store";
import { loadPolicy } from "../policy/policy.store";
import { requestApproval } from "../approvals/approval.engine";
import { execute } from "../execute/execute";
import { formatExecutionResult } from "../execute/execute.format";
import { isExecutionSuccess } from "../execute/execute.types";
import { logger } from "../utils/logger";
import { makeRunId, nowIso } from "../utils/time";
import type { Plan } from "../planner/plan.schema";
import type { ApprovalDecision } from "../approvals/approval.types";
import { processReceipt } from "../receipts/receipt.process";
import { savePendingReceipt, clearPendingReceipt } from "../receipts/pending.store";

import type { RunOutcome } from "../run/run.types";
import { formatRunOutcomeOneLine } from "../run/run.format";

export interface RunCommandOpts {
  once?: boolean;
  dryRun?: boolean;
  planId?: string;

  // optional: daemon injects this so risk engine can emit execution_failure triggers
  runtime?: {
    consecutiveFailures: number;
    failureThreshold: number;
  };
}

function buildDryRunApprovalDecision(): ApprovalDecision {
  return {
    requestId: "dry-run-auto",
    decidedAt: nowIso(),
    routing: "yolo",
    approved: true,
    reason: "Dry run — simulation only, no real chain interaction",
    approvedBy: "auto_yolo",
  };
}

export async function runOnce(opts: RunCommandOpts): Promise<RunOutcome> {
  const isDryRun = opts.dryRun ?? false;
  const runId = makeRunId();

  logger.section(
    `Guardian Run — ${runId}` +
      (isDryRun ? " (DRY RUN)" : "") +
      (opts.planId ? ` (plan-id: ${opts.planId})` : "")
  );

  try {
    const ctx = makeSolanaContext();
    const policy = loadPolicy();

    // ── 1) Snapshot ───────────────────────────────────────────────────────
    const snapSpinner = ora("Taking wallet + market snapshot...").start();
    let snapshot;
    try {
      snapshot = await takeSnapshot(ctx);
      snapSpinner.succeed("Snapshot complete");
    } catch (err) {
      snapSpinner.fail("Snapshot failed");
      const msg = err instanceof Error ? err.message : String(err);
      const out: RunOutcome = {
        runId,
        ok: false,
        status: "SNAPSHOT_FAILED",
        message: "Snapshot failed",
        errorMessage: msg,
      };
      logger.raw(formatRunOutcomeOneLine(out));
      return out;
    }

    logger.blank();
    logger.raw(formatSnapshotSummary(snapshot));

    // ── 2) Risk evaluation ────────────────────────────────────────────────
    const riskReport = evaluateRisk(snapshot, opts.runtime);
    logger.raw(formatRiskReport(riskReport));
    logger.blank();

    // ── 3) Plan ───────────────────────────────────────────────────────────
    let plan: Plan;

    if (opts.planId) {
      const loaded = loadPlan(opts.planId);
      if (!loaded) {
        const out: RunOutcome = {
          runId,
          ok: false,
          status: "PLANNING_FAILED",
          message: `Saved plan not found: ${opts.planId}`,
          planId: opts.planId,
          errorMessage: `Plan missing on disk: ${opts.planId}`,
        };
        logger.raw(formatRunOutcomeOneLine(out));
        return out;
      }
      plan = loaded;
      logger.info(`Loaded saved plan: ${plan.planId} — "${plan.label}"`);
    } else {
      if (riskReport.riskLevel === "NONE" && riskReport.triggerCount === 0) {
        const out: RunOutcome = {
          runId,
          ok: true,
          status: "NO_TRIGGERS",
          message: "Risk level NONE; no triggers active; no action needed.",
        };
        logger.raw(formatRunOutcomeOneLine(out));
        return out;
      }

      const planSpinner = ora("Calling LLM planner...").start();
      try {
        const planResult = await generatePlan({
          snapshot,
          riskReport,
          policy,
          triggerReason: "auto",
        });
        planSpinner.succeed("Plan generated");
        plan = planResult.plan;
        savePlan(plan);
      } catch (err) {
        planSpinner.fail("Planning error");
        const msg = err instanceof Error ? err.message : String(err);
        const out: RunOutcome = {
          runId,
          ok: false,
          status: "PLANNING_FAILED",
          message: "Planning exception",
          errorMessage: msg,
        };
        logger.raw(formatRunOutcomeOneLine(out));
        return out;
      }
    }

    if (plan.actionType === "none" || plan.actionType === "halt") {
      const out: RunOutcome = {
        runId,
        ok: true,
        status: "NO_ACTION_PLAN",
        message: `Plan specifies no action: ${plan.actionType} — ${plan.label}`,
        planId: plan.planId,
      };
      logger.raw(formatRunOutcomeOneLine(out));
      return out;
    }

    // ── 4) Policy Check (Execution Gate) ──────────────────────────────────
    const policyDecision = checkPlanAgainstPolicy(plan);
    logger.blank();
    logger.raw(formatPlanBundle(plan, policyDecision));
    logger.blank();

    if (policyDecision.status === "DENIED") {
      logger.error("Plan DENIED by policy engine. Execution aborted.");
      const out: RunOutcome = {
        runId,
        ok: false,
        status: "POLICY_DENIED",
        message: "Policy engine denied the plan.",
        planId: plan.planId,
      };
      logger.raw(formatRunOutcomeOneLine(out));
      return out;
    }

    // ── 5) Approval Engine ────────────────────────────────────────────────
    let approvalDecision: ApprovalDecision;

    if (isDryRun) {
      logger.info(chalk.magenta("DRY RUN: Auto-approving for simulation"));
      approvalDecision = buildDryRunApprovalDecision();
    } else {
      const approvalResult = await requestApproval({ plan, policyDecision, snapshot, riskReport });
      approvalDecision = approvalResult.decision;

      if (!approvalDecision.approved) {
        logger.warn(`Execution rejected by ${approvalDecision.approvedBy}`);
        const out: RunOutcome = {
          runId,
          ok: true, // It's "ok" in the sense that the agent didn't crash, it was manually stopped
          status: "APPROVAL_REJECTED",
          message: `Rejected by ${approvalDecision.approvedBy}: ${approvalDecision.reason}`,
          planId: plan.planId,
          approvalRequestId: approvalResult.request.requestId,
        };
        logger.raw(formatRunOutcomeOneLine(out));
        return out;
      }
      logger.success(`Execution approved by ${approvalDecision.approvedBy}`);
    }

    // ── 6) Execute ────────────────────────────────────────────────────────
    logger.section("Execution");

    const result = await execute(ctx, {
      plan,
      approvalDecision,
      policyDecision,
      snapshotAtPlan: snapshot,
      isSimulation: isDryRun,
    });

    logger.blank();
    logger.raw(formatExecutionResult(result));
    logger.blank();

    if (!isExecutionSuccess(result)) {
      const out: RunOutcome = {
        runId,
        ok: false,
        status: "EXECUTION_FAILURE",
        message: `Execution failed: [${result.reason}] ${result.message}`,
        planId: plan.planId,
        errorMessage: result.message,
      };
      logger.raw(formatRunOutcomeOneLine(out));
      return out;
    }

    if (isDryRun) {
      const out: RunOutcome = {
        runId,
        ok: true,
        status: "DRY_RUN_DONE",
        message: "Dry run completed successfully.",
        planId: plan.planId,
      };
      logger.raw(formatRunOutcomeOneLine(out));
      return out;
    }

    // ── 7) Pending Receipt & Process ──────────────────────────────────────
    savePendingReceipt({
      runId,
      planId: plan.planId,
      approvalRequestId: approvalDecision.requestId,
      snapshotId: snapshot.snapshotId,
      actionTxSignature: result.txSignature,
      confirmedAt: result.confirmedAt,
      lamportsSpent: result.lamportsSpent,
      savedAt: nowIso(),
    });

    try {
      const receiptOut = await processReceipt({
        ctx,
        plan,
        policyDecision,
        execution: result,
        approvalRequestId: approvalDecision.requestId,
        runId,
        preSnapshot: {
          snapshotId: snapshot.snapshotId,
          timestamp: snapshot.timestamp,
          solLamports: snapshot.solLamports,
          solBalance: snapshot.solBalance,
          estimatedPortfolioUsd: snapshot.estimatedPortfolioUsd,
        },
      });

      clearPendingReceipt();

      const out: RunOutcome = {
        runId,
        ok: true,
        status: "EXECUTION_SUCCESS",
        message: "Execution completely processed and receipt anchored.",
        planId: plan.planId,
        actionTxSignature: result.txSignature,
        receiptHash: receiptOut.receiptHash,
        anchorTxSignature: receiptOut.anchorTxSignature,
      };
      logger.raw(formatRunOutcomeOneLine(out));
      return out;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Receipt processing failed: ${msg}`);
      const out: RunOutcome = {
        runId,
        ok: false,
        status: "RECEIPT_FAILED",
        message: "Execution succeeded but receipt failed.",
        planId: plan.planId,
        actionTxSignature: result.txSignature,
        errorMessage: msg,
      };
      logger.raw(formatRunOutcomeOneLine(out));
      return out;
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Unhandled exception in runOnce: ${msg}`);
    const out: RunOutcome = {
      runId,
      ok: false,
      status: "UNKNOWN_ERROR",
      message: "An unknown exception escaped the loop.",
      errorMessage: msg,
    };
    logger.raw(formatRunOutcomeOneLine(out));
    return out;
  }
}
