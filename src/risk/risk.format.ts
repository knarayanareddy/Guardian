import chalk from "chalk";
import type { RiskReport, RiskLevel } from "./risk.types";

const LEVEL_COLORS: Record<RiskLevel, (s: string) => string> = {
  NONE: chalk.green,
  LOW: chalk.cyan,
  MEDIUM: chalk.yellow,
  HIGH: chalk.red,
  CRITICAL: (s) => chalk.bold(chalk.red(s)),
};

const LEVEL_ICONS: Record<RiskLevel, string> = {
  NONE: "✓",
  LOW: "◆",
  MEDIUM: "⚠",
  HIGH: "✗",
  CRITICAL: "☠",
};

export function formatRiskReport(report: RiskReport): string {
  const color = LEVEL_COLORS[report.riskLevel];
  const icon = LEVEL_ICONS[report.riskLevel];
  const lines: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────────
  lines.push(color(`${icon} Risk Level: ${report.riskLevel}`));
  lines.push(`  Evaluated at  : ${report.evaluatedAt}`);
  lines.push(`  Snapshot ID   : ${report.snapshotId}`);
  lines.push(`  Policy hash   : ${report.policyHash.slice(0, 16)}...`);
  lines.push(`  Trigger count : ${report.triggerCount}`);
  lines.push(`  Recommended   : ${report.recommendedAction}`);
  lines.push("");

  // ── Snapshot summary ───────────────────────────────────────────────────
  const snap = report.snapshot;
  const solPrice = snap.prices["So11111111111111111111111111111111111111112"] ?? 0;
  lines.push("  Portfolio:");
  lines.push(`    SOL balance : ${snap.solBalance.toFixed(6)} SOL`);
  lines.push(`    SOL price   : $${solPrice.toFixed(2)}`);
  lines.push(`    Est. value  : $${snap.estimatedPortfolioUsd.toFixed(2)}`);
  lines.push("");

  // ── Triggers ───────────────────────────────────────────────────────────
  if (report.triggers.length === 0) {
    lines.push(chalk.green("  No triggers active. All clear."));
  } else {
    lines.push(color(`  Active triggers (${report.triggers.length}):`));
    for (const t of report.triggers) {
      switch (t.kind) {
        case "drawdown":
          lines.push(
            color(
              `    ↓ [DRAWDOWN] ${t.symbol ?? t.mint.slice(0, 12)} ` +
              `dropped ${t.dropPct.toFixed(2)}% over ${t.windowMinutes}min ` +
              `(threshold: ${t.thresholdPct}%) ` +
              `$${t.windowStartPriceUsd.toFixed(4)} → $${t.currentPriceUsd.toFixed(4)}`
            )
          );
          lines.push(
            chalk.gray(
              `      → Recommended action: ${t.recommendedAction}`
            )
          );
          break;
        case "rug_risk":
          lines.push(
            color(
              `    ☠ [RUG RISK] ${t.mint.slice(0, 12)}... ` +
              `score=${t.riskScore.toFixed(2)} (threshold: ${t.thresholdScore.toFixed(2)})`
            )
          );
          break;
        case "low_sol":
          lines.push(
            color(
              `    ⛽ [LOW SOL] ${t.currentLamports} lamports` +
              ` (min: ${t.thresholdLamports})`
            )
          );
          break;
        case "execution_failure":
          lines.push(
            color(
              `    ✗ [EXEC FAILURE] ${t.failureCount} consecutive failures` +
              ` (threshold: ${t.thresholdCount})`
            )
          );
          break;
      }
    }
  }

  lines.push("");

  // ── Summary ────────────────────────────────────────────────────────────
  lines.push(chalk.gray("  Summary:"));
  for (const line of report.summary.split("\n")) {
    lines.push(chalk.gray(`    ${line}`));
  }

  return lines.join("\n");
}
