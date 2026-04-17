import type { WalletSnapshot } from "../state/snapshot.schema";
import type {
  TriggerEvent,
  DrawdownTrigger,
  LowSolTrigger,
  RiskReport,
  RiskLevel,
} from "./risk.types";
import {
  getWindowStartObservation,
} from "../state/price-history.store";
import { loadPolicy, hashPolicy } from "../policy/policy.store";
import { WSOL_MINT } from "../solana/addresses";
import { logger } from "../utils/logger";
import { nowIso } from "../utils/time";

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Minimum SOL lamports to keep for transaction fees.
 * Below this, the agent cannot sign transactions.
 */
const LOW_SOL_THRESHOLD_LAMPORTS = 50_000;

// ── Internal evaluators ────────────────────────────────────────────────────

/**
 * Evaluate drawdown trigger for a specific mint.
 */
function evaluateDrawdown(
  mint: string,
  symbol: string | undefined,
  currentPriceUsd: number,
  windowMinutes: number,
  thresholdPct: number,
  deRiskAction: DrawdownTrigger["recommendedAction"]
): DrawdownTrigger | null {
  const windowStartObs = getWindowStartObservation(mint, windowMinutes);

  if (!windowStartObs) {
    logger.debug(`Drawdown check: no history for ${symbol ?? mint} in window ${windowMinutes}min`);
    return null;
  }

  const windowStartPrice = windowStartObs.priceUsd;
  if (windowStartPrice <= 0) return null;

  const dropPct = ((windowStartPrice - currentPriceUsd) / windowStartPrice) * 100;

  logger.debug(
    `Drawdown check: ${symbol ?? mint}` +
    ` start=$${windowStartPrice.toFixed(4)}` +
    ` current=$${currentPriceUsd.toFixed(4)}` +
    ` drop=${dropPct.toFixed(2)}%` +
    ` threshold=${thresholdPct}%`
  );

  if (dropPct >= thresholdPct) {
    return {
      kind: "drawdown",
      mint,
      symbol,
      windowMinutes,
      windowStartPriceUsd: windowStartPrice,
      currentPriceUsd,
      dropPct,
      thresholdPct,
      recommendedAction: deRiskAction,
    };
  }

  return null;
}

/**
 * Evaluate low SOL trigger.
 */
function evaluateLowSol(solLamports: number): LowSolTrigger | null {
  if (solLamports < LOW_SOL_THRESHOLD_LAMPORTS) {
    return {
      kind: "low_sol",
      currentLamports: solLamports,
      thresholdLamports: LOW_SOL_THRESHOLD_LAMPORTS,
      message: `SOL balance (${solLamports} lamports) is below fee reserve threshold (${LOW_SOL_THRESHOLD_LAMPORTS} lamports). Refill required before any transactions can proceed.`,
    };
  }
  return null;
}

/**
 * Derive overall risk level from trigger list.
 */
function computeRiskLevel(triggers: TriggerEvent[]): RiskLevel {
  if (triggers.length === 0) return "NONE";

  const hasLowSol = triggers.some((t) => t.kind === "low_sol");
  const hasDrawdown = triggers.some((t) => t.kind === "drawdown");
  const hasRug = triggers.some((t) => t.kind === "rug_risk");
  const hasExecFailure = triggers.some((t) => t.kind === "execution_failure");

  if (hasRug) return "CRITICAL";
  if (hasExecFailure) return "HIGH";
  if (hasDrawdown) {
    const drawdowns = triggers.filter((t): t is DrawdownTrigger => t.kind === "drawdown");
    const maxDrop = Math.max(...drawdowns.map((d) => d.dropPct));
    if (maxDrop >= 20) return "CRITICAL";
    if (maxDrop >= 10) return "HIGH";
    return "MEDIUM";
  }
  if (hasLowSol) return "LOW";

  return "LOW";
}

/**
 * Derive a single recommended action from triggers.
 */
function computeRecommendedAction(
  triggers: TriggerEvent[]
): RiskReport["recommendedAction"] {
  if (triggers.some((t) => t.kind === "low_sol")) return "refill_sol";
  if (triggers.some((t) => t.kind === "rug_risk")) return "swap_to_usdc";
  if (triggers.some((t) => t.kind === "execution_failure")) return "halt_and_alert";

  const drawdowns = triggers.filter((t): t is DrawdownTrigger => t.kind === "drawdown");
  if (drawdowns.length > 0) {
    const worst = drawdowns.reduce((a, b) => (a.dropPct >= b.dropPct ? a : b));
    return worst.recommendedAction;
  }

  return "none";
}

/**
 * Build a human-readable summary string from a trigger list.
 */
function buildSummary(triggers: TriggerEvent[], level: RiskLevel): string {
  if (triggers.length === 0) return "No risk triggers detected. Portfolio within normal parameters.";

  const lines = [`Risk level: ${level}. ${triggers.length} trigger(s) active.`];

  for (const t of triggers) {
    switch (t.kind) {
      case "drawdown":
        lines.push(
          `  ↓ DRAWDOWN: ${t.symbol ?? t.mint.slice(0, 8)} dropped ${t.dropPct.toFixed(2)}%` +
          ` over ${t.windowMinutes}min (threshold: ${t.thresholdPct}%)` +
          ` [$${t.windowStartPriceUsd.toFixed(4)} → $${t.currentPriceUsd.toFixed(4)}]`
        );
        break;
      case "rug_risk":
        lines.push(
          `  ☠ RUG RISK: ${t.mint.slice(0, 12)}... score=${t.riskScore.toFixed(2)} (threshold: ${t.thresholdScore.toFixed(2)})`
        );
        break;
      case "low_sol":
        lines.push(`  ⛽ LOW SOL: ${t.currentLamports} lamports remaining (min: ${t.thresholdLamports})`);
        break;
      case "execution_failure":
        lines.push(`  ✗ EXEC FAILURE: ${t.failureCount} consecutive failures (threshold: ${t.thresholdCount})`);
        break;
    }
  }

  return lines.join("\n");
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Evaluate a snapshot against the current policy and return a RiskReport.
 * Pure / deterministic — no LLM calls, no side effects.
 */
export function evaluateRisk(snapshot: WalletSnapshot): RiskReport {
  const policy = loadPolicy();
  const policyHash = hashPolicy(policy);
  const triggers: TriggerEvent[] = [];

  // ── 1. Drawdown trigger ────────────────────────────────────────────────
  if (policy.drawdownTrigger.enabled) {
    const solMint = WSOL_MINT.toBase58();
    const currentSolPrice = snapshot.prices[solMint] ?? 0;

    if (currentSolPrice > 0) {
      const drawdownTrigger = evaluateDrawdown(
        solMint,
        "SOL",
        currentSolPrice,
        policy.drawdownTrigger.windowMinutes,
        policy.drawdownTrigger.thresholdPct,
        policy.drawdownTrigger.deRiskAction
      );
      if (drawdownTrigger) triggers.push(drawdownTrigger);
    }

    for (const spl of snapshot.splBalances) {
      const splPrice = snapshot.prices[spl.mint] ?? 0;
      if (splPrice > 0) {
        const splDrawdown = evaluateDrawdown(
          spl.mint,
          spl.symbol,
          splPrice,
          policy.drawdownTrigger.windowMinutes,
          policy.drawdownTrigger.thresholdPct,
          policy.drawdownTrigger.deRiskAction
        );
        if (splDrawdown) triggers.push(splDrawdown);
      }
    }
  }

  // ── 2. Low SOL trigger ─────────────────────────────────────────────────
  const lowSolTrigger = evaluateLowSol(snapshot.solLamports);
  if (lowSolTrigger) triggers.push(lowSolTrigger);

  // ── 3. Rug risk triggers (from snap.rugReports if present) ─────────────
  if (snapshot.rugReports) {
    const thresh = policy.requireApprovalIf.riskScoreAbove ?? 0.7;
    for (const [mint, report] of Object.entries(snapshot.rugReports)) {
      const scoreMatch = report.match(/score:([\d.]+)/i);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : undefined;
      if (score !== undefined && score > thresh) {
        triggers.push({
          kind: "rug_risk",
          mint,
          riskScore: score,
          thresholdScore: thresh,
          reportSummary: report.slice(0, 200),
        });
      }
    }
  }

  const riskLevel = computeRiskLevel(triggers);
  const recommendedAction = computeRecommendedAction(triggers);
  const summary = buildSummary(triggers, riskLevel);

  return {
    evaluatedAt: nowIso(),
    snapshotId: snapshot.snapshotId,
    riskLevel,
    triggers,
    triggerCount: triggers.length,
    snapshot,
    policyHash,
    recommendedAction,
    summary,
  };
}
