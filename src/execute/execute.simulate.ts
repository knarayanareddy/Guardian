import type { Plan } from "../planner/plan.schema";
import type { ExecutionResult, ExecutionAttempt } from "./execute.types";
import { solanaExplorerTxUrl, solscanTxUrl } from "../solana/explorerLinks";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";
import { nowIso } from "../utils/time";

/**
 * Simulated execution — returns a deterministic fake result.
 * Never touches the Solana network.
 * Used for:
 *   - guardian run --once --dry-run
 *   - unit tests
 *   - demoing the full cycle without real funds
 */
export async function simulateExecution(plan: Plan): Promise<ExecutionResult> {
  const config = loadConfig();

  logger.warn("SIMULATION MODE — no real transaction will be sent.");

  const startedAt = nowIso();

  // Simulate a brief network delay
  await new Promise((resolve) => setTimeout(resolve, 400));

  const finishedAt = nowIso();

  // Fake signature — clearly marked as simulation
  const fakeSig = `SIMULATED_${plan.planId}_${Date.now()}`;

  const attempt: ExecutionAttempt = {
    attemptNumber: 1,
    startedAt,
    finishedAt,
    success: true,
    txSignature: fakeSig,
  };

  // Derive lamports spent from plan
  let lamportsSpent = 0;
  if (plan.actionType === "swap" && plan.swapParams) {
    lamportsSpent = plan.swapParams.inputAmountLamports;
  } else if (plan.actionType === "transfer" && plan.transferParams) {
    lamportsSpent = plan.transferParams.amountLamports;
  }

  logger.success(`Simulation complete. Fake sig: ${fakeSig}`);

  return {
    status: "success",
    txSignature: fakeSig,
    confirmedAt: finishedAt,
    explorerUrl: solanaExplorerTxUrl(fakeSig, config.solanaNetwork),
    solscanUrl: solscanTxUrl(fakeSig, config.solanaNetwork),
    attempts: [attempt],
    lamportsSpent,
    isSimulation: true,
  };
}
