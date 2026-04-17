import type { Plan } from "../planner/plan.schema";
import type { WalletSnapshot } from "../state/snapshot.schema";
import type { ExecutionFailure } from "./execute.types";
import { checkPlanAgainstPolicy } from "../policy/policy.plan.bridge";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";

export interface PreFlightResult {
  ok: boolean;
  failure?: ExecutionFailure;
}

/**
 * Final pre-flight safety checks run immediately before chain call.
 *
 * Checks:
 *   1. Network safety (no mainnet in MVP)
 *   2. Sufficient SOL for fees
 *   3. Re-validate plan against current policy (defense-in-depth)
 *   4. Action type sanity (no "none"/"halt" reaching execution)
 */
export function runPreFlightGuard(
  plan: Plan,
  snapshot: WalletSnapshot
): PreFlightResult {
  const config = loadConfig();

  const fail = (reason: ExecutionFailure["reason"], message: string): PreFlightResult => {
    logger.error(`Pre-flight DENIED [${reason}]: ${message}`);
    return {
      ok: false,
      failure: {
        status: "failure",
        reason,
        message,
        attempts: [],
        isSimulation: false,
      },
    };
  };

  // ── 1. Network safety ────────────────────────────────────────────────────
  if (config.solanaNetwork === "mainnet-beta") {
    // Guardian MVP is devnet-only.
    // This guard prevents accidental mainnet execution.
    return fail(
      "pre_flight_denied",
      "Guardian MVP is devnet-only. Set SOLANA_NETWORK=devnet in .env."
    );
  }

  // ── 2. SOL fee reserve ───────────────────────────────────────────────────
  // A Solana transaction costs ~5,000 lamports per signature.
  // We require at least 50,000 lamports (0.00005 SOL) to safely proceed.
  const MIN_FEE_LAMPORTS = 50_000;
  if (snapshot.solLamports < MIN_FEE_LAMPORTS) {
    return fail(
      "pre_flight_denied",
      `Insufficient SOL for fees: ${snapshot.solLamports} lamports ` +
      `(minimum: ${MIN_FEE_LAMPORTS}). Run: guardian airdrop --sol 1`
    );
  }

  // ── 3. No-action guard ────────────────────────────────────────────────────
  if (plan.actionType === "none" || plan.actionType === "halt") {
    return fail(
      "pre_flight_denied",
      `Plan actionType="${plan.actionType}" should never reach execution.`
    );
  }

  // ── 4. Re-validate against current policy (defense-in-depth) ────────────
  const freshDecision = checkPlanAgainstPolicy(plan);
  if (!freshDecision.ok) {
    const reasons = freshDecision.violations.map((v) => v.detail).join("; ");
    return fail(
      "pre_flight_denied",
      `Policy re-check DENIED at execution time: ${reasons}`
    );
  }

  logger.debug("Pre-flight guard passed.");
  return { ok: true };
}
