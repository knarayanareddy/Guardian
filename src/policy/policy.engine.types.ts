import type { Policy } from "./policy.schema";

// ── Input types ────────────────────────────────────────────────────────────

export interface CheckSwapInput {
  fromMint: string;           // base58 mint address (SOL/WSOL or SPL)
  toMint: string;             // base58 mint address
  inputAmountLamports: number; // amount being spent in lamports (SOL-equivalent)
  slippageBps: number;        // requested slippage in basis points
  estimatedRiskScore?: number; // 0–1 rugcheck score (optional)
}

export interface CheckTransferInput {
  mint: string;                // base58 mint address or "SOL"/"native"
  destinationAddress: string;  // base58 recipient address
  amountLamports: number;      // amount in lamports
  estimatedRiskScore?: number;
}

// ── Output types ───────────────────────────────────────────────────────────

export type PolicyDecisionStatus =
  | "ALLOWED"           // action is within policy; can proceed
  | "REQUIRES_APPROVAL" // action is within policy but needs human sign-off
  | "DENIED";           // action violates policy; must not proceed

export interface PolicyViolation {
  rule: string;
  detail: string;
}

export interface PolicyDecision {
  status: PolicyDecisionStatus;
  ok: boolean;                // true only if ALLOWED or REQUIRES_APPROVAL
  violations: PolicyViolation[];
  approvalReasons: string[];  // reasons why approval is required (if any)
  policy: Policy;             // snapshot of policy that was evaluated
  policyHash: string;         // hash of that policy
  todaySpentLamports: number;
  todayRemainingLamports: number;
  input: CheckSwapInput | CheckTransferInput;
  evaluatedAt: string;        // ISO timestamp
}
