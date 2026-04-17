import type { Plan } from "../planner/plan.schema";
import type { PolicyDecision } from "./policy.engine.types";
import { checkSwap, checkTransfer } from "./policy.engine";
import { loadPolicy, hashPolicy } from "./policy.store";
import { getTodaySpendLamports } from "./spend-ledger.store";
import { nowIso } from "../utils/time";

/**
 * Run the appropriate policy check for a given Plan.
 * Returns a PolicyDecision.
 *
 * This is the MANDATORY gate between planning and execution.
 * Called in: plan command (Phase 5+6), execution (Phase 7).
 */
export function checkPlanAgainstPolicy(
  plan: Plan,
  estimatedRiskScore?: number
): PolicyDecision {
  // ── Swap ────────────────────────────────────────────────────────────────
  if (plan.actionType === "swap" && plan.swapParams) {
    return checkSwap({
      fromMint: plan.swapParams.fromMint,
      toMint: plan.swapParams.toMint,
      inputAmountLamports: plan.swapParams.inputAmountLamports,
      slippageBps: plan.swapParams.slippageBps,
      estimatedRiskScore,
    });
  }

  // ── Transfer ────────────────────────────────────────────────────────────
  if (plan.actionType === "transfer" && plan.transferParams) {
    return checkTransfer({
      mint: plan.transferParams.mint,
      destinationAddress: plan.transferParams.destinationAddress,
      amountLamports: plan.transferParams.amountLamports,
      estimatedRiskScore,
    });
  }

  // ── None or halt — synthetic ALLOWED decision (no action to gate) ────────
  const policy = loadPolicy();
  const policyHash = hashPolicy(policy);
  const todaySpentLamports = getTodaySpendLamports();

  return {
    status: "ALLOWED",
    ok: true,
    violations: [],
    approvalReasons: [],
    policy,
    policyHash,
    todaySpentLamports,
    todayRemainingLamports: Math.max(
      0,
      policy.dailySpendCapLamports - todaySpentLamports
    ),
    input: {
      mint: "SOL",
      destinationAddress: "",
      amountLamports: 0,
    },
    evaluatedAt: nowIso(),
  };
}
