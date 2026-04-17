import * as fs from "fs";
import * as path from "path";
import {
  PriceHistorySchema,
  PriceObservationSchema,
  type PriceHistory,
  type PriceObservation,
  MAX_OBSERVATIONS,
} from "./price-history.schema";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";

// ── Helpers ────────────────────────────────────────────────────────────────

function getHistoryPath(): string {
  const config = loadConfig();
  return path.join(config.dataDir, "price-history.json");
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Load the full price history from disk.
 * Returns empty array if file doesn't exist or is malformed.
 */
export function loadPriceHistory(): PriceHistory {
  const p = getHistoryPath();
  if (!fs.existsSync(p)) return [];

  const raw = fs.readFileSync(p, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("price-history.json is malformed. Starting fresh.");
    return [];
  }

  const result = PriceHistorySchema.safeParse(parsed);
  if (!result.success) {
    logger.warn("price-history.json failed schema validation. Starting fresh.");
    return [];
  }

  return result.data;
}

/**
 * Persist price history to disk.
 * Enforces MAX_OBSERVATIONS rolling cap (oldest entries pruned).
 */
function savePriceHistory(history: PriceHistory): void {
  const p = getHistoryPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Rolling buffer: keep newest MAX_OBSERVATIONS entries
  const trimmed =
    history.length > MAX_OBSERVATIONS
      ? history.slice(history.length - MAX_OBSERVATIONS)
      : history;

  fs.writeFileSync(p, JSON.stringify(trimmed, null, 2), "utf8");
}

/**
 * Append a new price observation and persist.
 */
export function appendPriceObservation(obs: PriceObservation): void {
  const validated = PriceObservationSchema.parse(obs);
  const history = loadPriceHistory();
  history.push(validated);
  savePriceHistory(history);
  logger.debug(`Price recorded: ${validated.symbol ?? validated.mint} = $${validated.priceUsd}`);
}

/**
 * Return all observations for a given mint, sorted oldest → newest.
 */
export function getObservationsForMint(mint: string): PriceObservation[] {
  const history = loadPriceHistory();
  return history
    .filter((o) => o.mint === mint)
    .sort((a, b) => a.unixTs - b.unixTs);
}

/**
 * Return the most recent observation for a given mint.
 * Returns undefined if no observations exist.
 */
export function getLatestObservation(mint: string): PriceObservation | undefined {
  const obs = getObservationsForMint(mint);
  return obs.length > 0 ? obs[obs.length - 1] : undefined;
}

/**
 * Return the oldest observation for a given mint within a time window.
 * windowMinutes: how far back to look.
 * Returns undefined if no observation exists in that window.
 */
export function getWindowStartObservation(
  mint: string,
  windowMinutes: number
): PriceObservation | undefined {
  const nowUnix = Math.floor(Date.now() / 1000);
  const windowStartUnix = nowUnix - windowMinutes * 60;

  const obs = getObservationsForMint(mint);

  // Find the oldest observation at or after the window start
  const inWindow = obs.filter((o) => o.unixTs >= windowStartUnix);
  return inWindow.length > 0 ? inWindow[0] : undefined;
}

/**
 * Return recent observations for display (last N entries across all mints).
 */
export function getRecentObservations(n: number = 20): PriceObservation[] {
  const history = loadPriceHistory();
  return history.slice(-n).reverse(); // most recent first
}

/**
 * Human-readable price history summary.
 */
export function formatPriceHistorySummary(n: number = 20): string {
  const recent = getRecentObservations(n);
  if (recent.length === 0) {
    return "No price history recorded yet. Run: guardian risk status";
  }

  const lines = [
    `Last ${recent.length} observation(s) (most recent first):`,
    "",
  ];

  for (const o of recent) {
    const sym = (o.symbol ?? o.mint.slice(0, 8) + "...").padEnd(10);
    lines.push(
      `  ${o.timestamp}  ${sym}  $${o.priceUsd.toFixed(4).padStart(10)}  [${o.source}]`
    );
  }

  return lines.join("\n");
}
