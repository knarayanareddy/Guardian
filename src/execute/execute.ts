import type { SolanaContext } from "../solana/makeAgent";
import type { ExecutionInput, ExecutionResult } from "./execute.types";
import { runPreFlightGuard } from "./execute.guard";
import { executeSwap } from "./execute.swap";
import { executeTransfer } from "./execute.transfer";
import { simulateExecution } from "./execute.simulate";
import { appendSpendEntry } from "../policy/spend-ledger.store";
import { isExecutionSuccess } from "./execute.types";
import { logger } from "../utils/logger";
import { nowIso } from "../utils/time";

/**
 * Main execution router.
 *
 * Steps:
 *   1. Guard: confirm approval is present
 *   2. Guard: run pre-flight safety checks
 *   3. Route to: simulator | swap executor | transfer executor
 *   4. On success: write spend ledger entry
 *   5. Return ExecutionResult
 *
 * This function NEVER calls the LLM.
 * Receipt writing happens in Phase 8 (caller's responsibility).
 */
export async function execute(
  ctx: SolanaContext,
  input: ExecutionInput
): Promise<ExecutionResult> {
  const { plan, approvalDecision, snapshotAtPlan, isSimulation } = input;

  logger.section(
    `Execute${isSimulation ? " (SIMULATION)" : ""}` +
    ` — ${plan.actionType.toUpperCase()} — ${plan.label}`
  );

  // ── 1. Approval guard ────────────────────────────────────────────────────
  if (!approvalDecision.approved) {
    const msg =
      `Execution blocked: approval record says NOT approved. ` +
      `approvedBy=${approvalDecision.approvedBy} reason="${approvalDecision.reason}"`;
    logger.error(msg);
    return {
      status: "failure",
      reason: "approval_missing",
      message: msg,
      attempts: [],
      isSimulation,
    };
  }

  // ── 2. Pre-flight guard (re-validate policy + fee reserve) ───────────────
  if (!isSimulation) {
    const preFlight = runPreFlightGuard(plan, snapshotAtPlan);
    if (!preFlight.ok && preFlight.failure) {
      return { ...preFlight.failure, isSimulation };
    }
  }

  // ── 3. Simulation branch ────────────────────────────────────────────────
  if (isSimulation) {
    const result = await simulateExecution(plan);
    logger.success(
      `Simulation result: ${result.status} tx=${(result as any).txSignature}`
    );
    return result;
  }

  // ── 4. Real execution branch ────────────────────────────────────────────
  let result: ExecutionResult;

  switch (plan.actionType) {
    case "swap": {
      if (!plan.swapParams) {
        return {
          status: "failure",
          reason: "pre_flight_denied",
          message: "Plan actionType=swap but swapParams is missing.",
          attempts: [],
          isSimulation: false,
        };
      }
      result = await executeSwap(ctx, plan.swapParams);
      break;
    }

    case "transfer": {
      if (!plan.transferParams) {
        return {
          status: "failure",
          reason: "pre_flight_denied",
          message: "Plan actionType=transfer but transferParams is missing.",
          attempts: [],
          isSimulation: false,
        };
      }
      result = await executeTransfer(ctx, plan.transferParams);
      break;
    }

    case "none":
    case "halt": {
      return {
        status: "failure",
        reason: "pre_flight_denied",
        message: `Plan actionType="${plan.actionType}" should not reach executor.`,
        attempts: [],
        isSimulation: false,
      };
    }

    default: {
      const _exhaustive: never = plan.actionType;
      return {
        status: "failure",
        reason: "unknown",
        message: `Unknown actionType: ${String(_exhaustive)}`,
        attempts: [],
        isSimulation: false,
      };
    }
  }

  // ── 5. On success — write spend ledger ──────────────────────────────────
  if (isExecutionSuccess(result)) {
    appendSpendEntry({
      timestamp: nowIso(),
      actionType: plan.actionType as "swap" | "transfer",
      lamports: result.lamportsSpent,
      txSignature: result.txSignature,
      note: `plan=${plan.planId} label="${plan.label}"`,
    });
    logger.success(
      `Spend ledger updated: ${result.lamportsSpent} lamports (${(result.lamportsSpent / 1e9).toFixed(6)} SOL)`
    );
  }

  return result;
}
