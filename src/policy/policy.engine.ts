import { type Policy } from "./policy.schema";
import { type PolicyDecision, type PolicyViolation, type CheckSwapInput, type CheckTransferInput } from "./policy.engine.types";
import { loadPolicy, hashPolicy } from "./policy.store";
import { getTodaySpendLamports } from "./spend-ledger.store";
import { WSOL_MINT } from "../solana/addresses";
import { nowIso } from "../utils/time";
import { logger } from "../utils/logger";

// ── Constants ──────────────────────────────────────────────────────────────

const WSOL_MINT_STR = WSOL_MINT.toBase58(); // "So111..."

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Normalize a mint string so "SOL" and the wSOL address are treated identically.
 */
function normalizeMint(mint: string): string {
  if (mint === "SOL" || mint === "native") return WSOL_MINT_STR;
  return mint;
}

/**
 * Check if a mint is allowed under the policy.
 * Rules (in priority order):
 *   1. If mint is in denyMints → DENIED
 *   2. If allowedMints is empty → ALL allowed
 *   3. If allowedMints is non-empty → must appear in list
 */
function isMintAllowed(mint: string, policy: Policy): { allowed: boolean; reason?: string } {
  const normalized = normalizeMint(mint);

  if (policy.denyMints.map(normalizeMint).includes(normalized)) {
    return { allowed: false, reason: `Mint ${mint} is on the deny list` };
  }

  if (policy.allowedMints.length === 0) {
    return { allowed: true };
  }

  if (policy.allowedMints.map(normalizeMint).includes(normalized)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Mint ${mint} is not in allowedMints and allowedMints is non-empty`,
  };
}

/**
 * Build a PolicyDecision from a set of violations + approval reasons.
 */
function buildDecision(params: {
  violations: PolicyViolation[];
  approvalReasons: string[];
  policy: Policy;
  policyHash: string;
  todaySpentLamports: number;
  input: CheckSwapInput | CheckTransferInput;
}): PolicyDecision {
  const { violations, approvalReasons, policy, policyHash, todaySpentLamports, input } = params;

  const todayRemainingLamports = Math.max(
    0,
    policy.dailySpendCapLamports - todaySpentLamports
  );

  let status: PolicyDecision["status"];
  if (violations.length > 0) {
    status = "DENIED";
  } else if (approvalReasons.length > 0) {
    status = "REQUIRES_APPROVAL";
  } else {
    status = "ALLOWED";
  }

  return {
    status,
    ok: status !== "DENIED",
    violations,
    approvalReasons,
    policy,
    policyHash,
    todaySpentLamports,
    todayRemainingLamports,
    input,
    evaluatedAt: nowIso(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Check a swap action against policy.
 * Deterministic — no LLM calls.
 */
export function checkSwap(input: CheckSwapInput): PolicyDecision {
  const policy = loadPolicy();
  const policyHash = hashPolicy(policy);
  const todaySpentLamports = getTodaySpendLamports();
  const violations: PolicyViolation[] = [];
  const approvalReasons: string[] = [];

  // 1) Action type allowed?
  if (!policy.allowedActions.includes("swap" as any)) {
    violations.push({ rule: "allowedActions", detail: "Swap actions are not permitted by policy" });
  }

  // 2) fromMint allowed?
  const fromCheck = isMintAllowed(input.fromMint, policy);
  if (!fromCheck.allowed) {
    violations.push({ rule: "fromMint", detail: fromCheck.reason ?? "fromMint denied" });
  }

  // 3) toMint allowed?
  const toCheck = isMintAllowed(input.toMint, policy);
  if (!toCheck.allowed) {
    violations.push({ rule: "toMint", detail: toCheck.reason ?? "toMint denied" });
  }

  // 4) Single action size
  if (input.inputAmountLamports > policy.maxSingleActionLamports) {
    violations.push({
      rule: "maxSingleActionLamports",
      detail: `Swap amount ${input.inputAmountLamports} lamports exceeds single-action cap ${policy.maxSingleActionLamports}`,
    });
  }

  // 5) Slippage
  if (input.slippageBps > policy.maxSlippageBps) {
    violations.push({
      rule: "maxSlippageBps",
      detail: `Slippage ${input.slippageBps} bps exceeds max ${policy.maxSlippageBps} bps`,
    });
  }

  // 6) Daily spend cap (project forward)
  const projectedDailySpend = todaySpentLamports + input.inputAmountLamports;
  if (projectedDailySpend > policy.dailySpendCapLamports) {
    violations.push({
      rule: "dailySpendCapLamports",
      detail: `Projected daily spend ${projectedDailySpend} exceeds daily cap ${policy.dailySpendCapLamports}`,
    });
  }

  // 7) Approval thresholds (only if no hard violations)
  if (violations.length === 0) {
    const thresh = policy.requireApprovalIf;

    if (thresh.overLamports !== undefined && input.inputAmountLamports > thresh.overLamports) {
      approvalReasons.push(
        `Swap amount ${input.inputAmountLamports} lamports > approval threshold ${thresh.overLamports}`
      );
    }

    if (thresh.newMint === true) {
      const fromNew = policy.allowedMints.length > 0 && !policy.allowedMints.map(m => m.toString()).includes(normalizeMint(input.fromMint));
      const toNew = policy.allowedMints.length > 0 && !policy.allowedMints.map(m => m.toString()).includes(normalizeMint(input.toMint));
      if (fromNew || toNew) {
        approvalReasons.push(`Mint not in explicit allowedMints list (fromMint=${input.fromMint}, toMint=${input.toMint})`);
      }
    }

    if (
      thresh.riskScoreAbove !== undefined &&
      input.estimatedRiskScore !== undefined &&
      input.estimatedRiskScore > thresh.riskScoreAbove
    ) {
      approvalReasons.push(
        `Risk score ${input.estimatedRiskScore.toFixed(2)} > threshold ${thresh.riskScoreAbove}`
      );
    }
  }

  const decision = buildDecision({
    violations,
    approvalReasons,
    policy,
    policyHash,
    todaySpentLamports,
    input,
  });

  logger.debug(`Policy check (swap): ${decision.status}`, {
    violations: decision.violations.map((v) => v.detail),
    approvalReasons: decision.approvalReasons,
  });

  return decision;
}

/**
 * Check a transfer action against policy.
 * Deterministic — no LLM calls.
 */
export function checkTransfer(input: CheckTransferInput): PolicyDecision {
  const policy = loadPolicy();
  const policyHash = hashPolicy(policy);
  const todaySpentLamports = getTodaySpendLamports();
  const violations: PolicyViolation[] = [];
  const approvalReasons: string[] = [];

  // 1) Action type allowed?
  if (!policy.allowedActions.includes("transfer" as any)) {
    violations.push({ rule: "allowedActions", detail: "Transfer actions are not permitted by policy" });
  }

  // 2) Mint allowed?
  const mintCheck = isMintAllowed(input.mint, policy);
  if (!mintCheck.allowed) {
    violations.push({ rule: "mint", detail: mintCheck.reason ?? "mint denied" });
  }

  // 3) Destination allowed?
  if (policy.allowedDestinations.length > 0) {
    if (!policy.allowedDestinations.includes(input.destinationAddress)) {
      violations.push({
        rule: "allowedDestinations",
        detail: `Destination ${input.destinationAddress} is not in allowedDestinations whitelist`,
      });
    }
  }

  // 4) Single action size
  if (input.amountLamports > policy.maxSingleActionLamports) {
    violations.push({
      rule: "maxSingleActionLamports",
      detail: `Transfer amount ${input.amountLamports} lamports exceeds single-action cap ${policy.maxSingleActionLamports}`,
    });
  }

  // 5) Daily spend cap (project forward)
  const projectedDailySpend = todaySpentLamports + input.amountLamports;
  if (projectedDailySpend > policy.dailySpendCapLamports) {
    violations.push({
      rule: "dailySpendCapLamports",
      detail: `Projected daily spend ${projectedDailySpend} exceeds daily cap ${policy.dailySpendCapLamports}`,
    });
  }

  // 6) Approval thresholds (only if no hard violations)
  if (violations.length === 0) {
    const thresh = policy.requireApprovalIf;

    if (thresh.overLamports !== undefined && input.amountLamports > thresh.overLamports) {
      approvalReasons.push(
        `Transfer amount ${input.amountLamports} lamports > approval threshold ${thresh.overLamports}`
      );
    }

    if (thresh.newMint === true && policy.allowedMints.length > 0) {
      const mintNew = !policy.allowedMints.map(m => m.toString()).includes(normalizeMint(input.mint));
      if (mintNew) {
        approvalReasons.push(`Mint ${input.mint} not in explicit allowedMints list`);
      }
    }

    if (
      thresh.riskScoreAbove !== undefined &&
      input.estimatedRiskScore !== undefined &&
      input.estimatedRiskScore > thresh.riskScoreAbove
    ) {
      approvalReasons.push(
        `Risk score ${input.estimatedRiskScore.toFixed(2)} > threshold ${thresh.riskScoreAbove}`
      );
    }
  }

  const decision = buildDecision({
    violations,
    approvalReasons,
    policy,
    policyHash,
    todaySpentLamports,
    input,
  });

  logger.debug(`Policy check (transfer): ${decision.status}`, {
    violations: decision.violations.map((v) => v.detail),
    approvalReasons: decision.approvalReasons,
  });

  return decision;
}
