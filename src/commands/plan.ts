import { makeSolanaContext } from "../solana/makeAgent";
import { loadConfig } from "../config/loadConfig";
import { takeSnapshot, formatSnapshotSummary } from "../state/snapshot";
import { evaluateRisk } from "../risk/risk.engine";
import { formatRiskReport } from "../risk/risk.format";
import { generatePlan } from "../planner/plan.llm";
import { checkPlanAgainstPolicy } from "../policy/policy.plan.bridge";
import { formatPlanBundle } from "../planner/plan.format";
import { savePlan } from "../planner/plan.store";
import { loadPolicy } from "../policy/policy.store";
import { requestApproval } from "../approvals/approval.engine";
import { logger } from "../utils/logger";
import chalk from "chalk";
import ora from "ora";

export interface PlanCommandOpts {
  reason?: string;
  dryRun?: boolean;
}

export async function runPlan(opts: PlanCommandOpts): Promise<void> {
  const triggerReason = opts.reason ?? "manual";
  const isDryRun = opts.dryRun ?? false;

  logger.section(`Guardian Plan${isDryRun ? " (dry-run)" : ""}`);
  logger.info(`Trigger reason : ${triggerReason}`);
  logger.info(`Dry run        : ${isDryRun}`);

  const ctx = makeSolanaContext();
  const policy = loadPolicy();

  // ── 1. Snapshot ──────────────────────────────────────────────────────────
  const snapSpinner = ora("Taking wallet + market snapshot...").start();
  let snapshot;
  try {
    snapshot = await takeSnapshot(ctx);
    snapSpinner.succeed("Snapshot complete");
  } catch (err) {
    snapSpinner.fail("Snapshot failed");
    throw err;
  }

  logger.blank();
  logger.raw(formatSnapshotSummary(snapshot));

  // ── 2. Risk evaluation ────────────────────────────────────────────────────
  const riskReport = evaluateRisk(snapshot);
  logger.raw(formatRiskReport(riskReport));
  logger.blank();

  // ── 3. Early exit: NONE risk + auto reason ────────────────────────────────
  if (
    triggerReason === "auto" &&
    riskReport.riskLevel === "NONE" &&
    riskReport.triggerCount === 0
  ) {
    logger.success(
      "Risk level NONE and trigger reason is auto — no planning required."
    );
    logger.blank();
    return;
  }

  // ── 4. LLM planning ───────────────────────────────────────────────────────
  const config = loadConfig();
  const planSpinner = ora(`Calling LLM planner (${config.llmModel})...`).start();
  let planResult;
  try {
    planResult = await generatePlan({
      snapshot,
      riskReport,
      policy,
      triggerReason,
    });
    planSpinner.succeed(
      `Plan generated on attempt ${planResult.attempts}/3`
    );
  } catch (err) {
    planSpinner.fail("Planning failed");
    throw err;
  }

  const { plan } = planResult;

  // ── 5. Policy check (mandatory gate) ─────────────────────────────────────
  const policyDecision = checkPlanAgainstPolicy(plan);

  // ── 6. Display plan + policy ──────────────────────────────────────────────
  logger.blank();
  logger.section("Plan + Policy Check");
  logger.raw(formatPlanBundle(plan, policyDecision));
  logger.blank();

  // ── 7. Save plan ──────────────────────────────────────────────────────────
  const savedPath = savePlan(plan);
  logger.info(`Plan saved: ${savedPath}`);

  // ── 8. Dry-run gate ───────────────────────────────────────────────────────
  if (isDryRun) {
    logger.blank();
    logger.raw(
      chalk.gray("─── DRY RUN MODE — approval prompt skipped, no execution ───")
    );
    logger.blank();
    return;
  }

  // ── 9. Hard denial gate ───────────────────────────────────────────────────
  if (policyDecision.status === "DENIED") {
    logger.blank();
    logger.error("Plan DENIED by policy. Cannot proceed to approval or execution.");
    logger.blank();
    return;
  }

  // ── 10. Approval engine ───────────────────────────────────────────────────
  logger.section("Approval");
  const approvalResult = await requestApproval({
    plan,
    policyDecision,
    snapshot,
    riskReport,
  });

  logger.blank();

  if (!approvalResult.approved) {
    logger.warn(
      `Plan not approved (by: ${approvalResult.decision.approvedBy}). ` +
      `Reason: ${approvalResult.decision.reason}`
    );
    logger.info(`Approval record: ${approvalResult.request.requestId}`);
    logger.blank();
    return;
  }

  // ── 11. Approved — inform that execution is Phase 7 ──────────────────────
  logger.success(
    `Plan approved by: ${approvalResult.decision.approvedBy}`
  );
  logger.info(`Approval record  : ${approvalResult.request.requestId}`);
  logger.info(`Plan ID          : ${plan.planId}`);
  logger.blank();
  logger.success(
    "Ready for execution. Run: guardian run --once"
  );
  logger.raw(
    chalk.gray(
      `  (or: guardian run --once --plan-id ${plan.planId})`
    )
  );
  logger.blank();
}
