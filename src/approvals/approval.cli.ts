import * as readline from "readline";
import chalk from "chalk";
import type { HumanDecision } from "./approval.types";
import { logger } from "../utils/logger";

/**
 * Present an interactive approval prompt to the user.
 *
 * Accepts:
 *   y / yes    → approved
 *   n / no     → rejected
 *   d / detail → print full details again (from caller) then re-prompt
 *   a / abort  → aborted (treated as rejected + flagged)
 *   ctrl+c     → aborted
 *
 * Returns a HumanDecision.
 */
export async function promptHumanApproval(params: {
  promptText: string;
  onShowDetails: () => void;
  timeoutSeconds?: number;
}): Promise<HumanDecision> {
  const { promptText, onShowDetails, timeoutSeconds } = params;
  const timeout = timeoutSeconds ?? 120; // 2 minute default timeout

  return new Promise<HumanDecision>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let resolved = false;

    // ── Timeout handler ──────────────────────────────────────────────────
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        rl.close();
        logger.warn(`Approval timed out after ${timeout}s. Treating as rejected.`);
        resolve("rejected");
      }
    }, timeout * 1000);

    // ── Handle ctrl+c ────────────────────────────────────────────────────
    rl.on("SIGINT", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        rl.close();
        logger.warn("Approval aborted by user (ctrl+c).");
        resolve("aborted");
      }
    });

    // ── Prompt loop ───────────────────────────────────────────────────────
    const ask = (): void => {
      rl.question(
        chalk.bold(`\n${promptText} [y/n/d/a]: `),
        (answer) => {
          const a = answer.trim().toLowerCase();

          if (a === "y" || a === "yes") {
            resolved = true;
            clearTimeout(timer);
            rl.close();
            resolve("approved");
            return;
          }

          if (a === "n" || a === "no") {
            resolved = true;
            clearTimeout(timer);
            rl.close();
            resolve("rejected");
            return;
          }

          if (a === "a" || a === "abort") {
            resolved = true;
            clearTimeout(timer);
            rl.close();
            resolve("aborted");
            return;
          }

          if (a === "d" || a === "details") {
            onShowDetails();
            ask();
            return;
          }

          // Invalid input — re-prompt
          logger.raw(
            chalk.gray(
              "  Invalid input. Enter: y=approve  n=reject  d=details  a=abort"
            )
          );
          ask();
        }
      );
    };

    ask();
  });
}

/**
 * Simple yes/no confirmation prompt (used for non-approval confirmations).
 */
export async function promptConfirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(chalk.bold(`${question} [y/n]: `), (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
    });
  });
}
