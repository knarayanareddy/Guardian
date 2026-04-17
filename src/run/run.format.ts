import chalk from "chalk";
import type { RunOutcome } from "./run.types";

export function formatRunOutcomeOneLine(o: RunOutcome): string {
  const icon = o.ok ? chalk.green("✓") : chalk.red("✗");
  const status = o.ok ? chalk.green(o.status) : chalk.red(o.status);

  const parts = [
    `${icon} ${status}`,
    `runId=${o.runId}`,
    o.planId ? `planId=${o.planId}` : "",
    o.actionTxSignature ? `actionTx=${o.actionTxSignature.slice(0, 16)}...` : "",
    o.receiptHash ? `receipt=${o.receiptHash.slice(0, 16)}...` : "",
    o.anchorTxSignature ? `anchorTx=${o.anchorTxSignature.slice(0, 16)}...` : "",
    `msg="${o.message.slice(0, 120)}"`,
  ].filter(Boolean);

  return parts.join("  ");
}
