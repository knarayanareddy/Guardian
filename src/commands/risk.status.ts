import { makeSolanaContext } from "../solana/makeAgent";
import { takeSnapshot, formatSnapshotSummary } from "../state/snapshot";
import { evaluateRisk } from "../risk/risk.engine";
import { formatRiskReport } from "../risk/risk.format";
import { logger } from "../utils/logger";
import ora from "ora";

export async function runRiskStatus(): Promise<void> {
  logger.section("Risk Status");

  const ctx = makeSolanaContext();

  // ── Snapshot ─────────────────────────────────────────────────────────
  const spinner = ora("Fetching wallet + market snapshot...").start();
  let snapshot;
  try {
    snapshot = await takeSnapshot(ctx);
    spinner.succeed("Snapshot complete");
  } catch (err) {
    spinner.fail("Snapshot failed");
    throw err;
  }

  logger.blank();
  logger.raw(formatSnapshotSummary(snapshot));

  // ── Risk evaluation ───────────────────────────────────────────────────
  const spinner2 = ora("Evaluating risk...").start();
  const report = evaluateRisk(snapshot);
  spinner2.succeed("Risk evaluation complete");

  logger.blank();
  logger.raw(formatRiskReport(report));
  logger.blank();
}
