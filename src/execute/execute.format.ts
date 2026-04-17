import chalk from "chalk";
import type { ExecutionResult, ExecutionAttempt } from "./execute.types";
import { isExecutionSuccess } from "./execute.types";

/**
 * Format a single attempt record for display.
 */
function formatAttempt(a: ExecutionAttempt): string {
  const status = a.success ? chalk.green("✓ ok") : chalk.red("✗ fail");
  const sig = a.txSignature
    ? `  sig=${a.txSignature.slice(0, 16)}...`
    : "";
  const err = a.errorMessage
    ? `  err="${a.errorMessage.slice(0, 80)}"`
    : "";
  return `    [${a.attemptNumber}] ${status}  started=${a.startedAt}${sig}${err}`;
}

/**
 * Format a full ExecutionResult for terminal display.
 */
export function formatExecutionResult(result: ExecutionResult): string {
  const lines: string[] = [];
  const simTag = result.isSimulation ? chalk.gray(" [SIMULATION]") : "";

  if (isExecutionSuccess(result)) {
    lines.push(chalk.green(`✓ Execution succeeded${simTag}`));
    lines.push(`  Tx signature : ${result.txSignature}`);
    lines.push(`  Confirmed at : ${result.confirmedAt}`);
    lines.push(`  Explorer     : ${result.explorerUrl}`);
    lines.push(`  Solscan      : ${result.solscanUrl}`);
    lines.push(`  Amount spent : ${(result.lamportsSpent / 1e9).toFixed(6)} SOL (${result.lamportsSpent} lamports)`);
    if (result.attempts.length > 0) {
      lines.push(`  Attempts (${result.attempts.length}):`);
      for (const a of result.attempts) {
        lines.push(formatAttempt(a));
      }
    }
  } else {
    lines.push(chalk.red(`✗ Execution failed${simTag}`));
    lines.push(chalk.red(`  Reason  : ${result.reason}`));
    lines.push(chalk.red(`  Message : ${result.message}`));
    if (result.attempts.length > 0) {
      lines.push(`  Attempts (${result.attempts.length}):`);
      for (const a of result.attempts) {
        lines.push(formatAttempt(a));
      }
    }
  }

  return lines.join("\n");
}
