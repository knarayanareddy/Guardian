import type { WalletSnapshot } from "../state/snapshot.schema";
import type { Policy } from "../policy/policy.schema";

// ── Trigger kinds ──────────────────────────────────────────────────────────

/**
 * Drawdown: price dropped by >= thresholdPct over a window.
 */
export interface DrawdownTrigger {
  kind: "drawdown";
  mint: string;
  symbol?: string;
  windowMinutes: number;
  windowStartPriceUsd: number;
  currentPriceUsd: number;
  dropPct: number;             // positive number = drop percentage
  thresholdPct: number;        // policy threshold that was breached
  recommendedAction: Policy["drawdownTrigger"]["deRiskAction"];
}

/**
 * Rug risk: token rugcheck report score exceeded threshold.
 */
export interface RugRiskTrigger {
  kind: "rug_risk";
  mint: string;
  riskScore: number;           // 0–1
  thresholdScore: number;
  reportSummary: string;
}

/**
 * Low SOL: agent wallet is running low on SOL for fees.
 */
export interface LowSolTrigger {
  kind: "low_sol";
  currentLamports: number;
  thresholdLamports: number;
  message: string;
}

/**
 * Execution failure: previous actions failed repeatedly.
 */
export interface ExecutionFailureTrigger {
  kind: "execution_failure";
  failureCount: number;
  thresholdCount: number;
  message: string;
}

// ── Union type ─────────────────────────────────────────────────────────────

export type TriggerEvent =
  | DrawdownTrigger
  | RugRiskTrigger
  | LowSolTrigger
  | ExecutionFailureTrigger;

// ── Risk report ────────────────────────────────────────────────────────────

export type RiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskReport {
  evaluatedAt: string;
  snapshotId: string;
  riskLevel: RiskLevel;
  triggers: TriggerEvent[];
  triggerCount: number;
  snapshot: WalletSnapshot;
  policyHash: string;

  // Recommended next action (derived from triggers)
  recommendedAction:
    | "none"
    | "swap_to_usdc"
    | "transfer_to_safe"
    | "halt_and_alert"
    | "refill_sol";

  // Human-readable summary
  summary: string;
}
