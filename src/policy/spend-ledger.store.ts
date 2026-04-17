import * as fs from "fs";
import * as path from "path";
import {
  SpendLedgerSchema,
  SpendEntrySchema,
  type SpendLedger,
  type SpendEntry,
} from "./spend-ledger.schema";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";

// ── Helpers ────────────────────────────────────────────────────────────────

function getLedgerPath(): string {
  const config = loadConfig();
  return path.join(config.dataDir, "spend-ledger.json");
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Load the full spend ledger from disk.
 * Returns empty array if file doesn't exist.
 */
export function loadSpendLedger(): SpendLedger {
  const p = getLedgerPath();
  if (!fs.existsSync(p)) return [];

  const raw = fs.readFileSync(p, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("spend-ledger.json is malformed. Starting fresh.");
    return [];
  }

  const result = SpendLedgerSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn("spend-ledger.json failed schema validation. Starting fresh.");
    return [];
  }

  return result.data;
}

/**
 * Persist the full ledger to disk.
 */
function saveSpendLedger(ledger: SpendLedger): void {
  const p = getLedgerPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(ledger, null, 2), "utf8");
}

/**
 * Append a new spend entry to the ledger.
 * Called by the execution subsystem (Phase 7).
 */
export function appendSpendEntry(entry: Omit<SpendEntry, "utcDate">): SpendEntry {
  const full: SpendEntry = {
    ...entry,
    utcDate: entry.timestamp.slice(0, 10),
  };

  const validated = SpendEntrySchema.parse(full);
  const ledger = loadSpendLedger();
  ledger.push(validated);
  saveSpendLedger(ledger);

  logger.debug(`Spend entry recorded: ${validated.actionType} ${validated.lamports} lamports`);
  return validated;
}

/**
 * Return the total lamports spent today (UTC day).
 */
export function getTodaySpendLamports(): number {
  const today = todayUtc();
  const ledger = loadSpendLedger();
  return ledger
    .filter((e: SpendEntry) => e.utcDate === today)
    .reduce((acc: number, e: SpendEntry) => acc + e.lamports, 0);
}

/**
 * Return all entries for today (UTC).
 */
export function getTodayEntries(): SpendLedger {
  const today = todayUtc();
  return loadSpendLedger().filter((e: SpendEntry) => e.utcDate === today);
}

/**
 * Human-readable summary of today's spend.
 */
export function formatTodaySpendSummary(): string {
  const entries = getTodayEntries();
  const totalLamports = entries.reduce((acc: number, e: SpendEntry) => acc + e.lamports, 0);
  const totalSol = (totalLamports / 1e9).toFixed(6);

  const lines: string[] = [
    `Total entries today: ${entries.length}`,
    `Total spent today: ${totalSol} SOL (${totalLamports} lamports)`,
    "",
    "Entries:",
  ];

  if (entries.length === 0) {
    lines.push("  (none)");
  } else {
    for (const e of entries) {
      lines.push(
        `  [${e.timestamp}] ${e.actionType.padEnd(8)} ` +
          `${(e.lamports / 1e9).toFixed(6)} SOL` +
          (e.txSignature ? `  tx=${e.txSignature.slice(0, 12)}...` : "") +
          (e.note ? `  note=${e.note}` : "")
      );
    }
  }

  return lines.join("\n");
}
