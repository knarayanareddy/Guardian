import type { SolanaContext } from "../solana/makeAgent";
import type { PlanSwapParams } from "../planner/plan.schema";
import type {
  ExecutionResult,
  ExecutionAttempt,
  ExecutionFailureReason,
} from "./execute.types";
import { PublicKey } from "@solana/web3.js";
import { solanaExplorerTxUrl, solscanTxUrl } from "../solana/explorerLinks";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";
import { nowIso, sleep } from "../utils/time";

// ── Retry config ───────────────────────────────────────────────────────────

const RETRY_DELAY_MS = 2_000; // 2s between retries

// ── Error classification ───────────────────────────────────────────────────

function classifySwapError(err: unknown): {
  reason: ExecutionFailureReason;
  message: string;
} {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("blockhash not found") || lower.includes("blockhash")) {
    return { reason: "tx_send_failed", message: `Blockhash expired: ${msg}` };
  }
  if (lower.includes("insufficient funds") || lower.includes("insufficient lamports")) {
    return { reason: "tx_execution_failed", message: `Insufficient funds: ${msg}` };
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return { reason: "tx_confirm_timeout", message: `Confirmation timeout: ${msg}` };
  }
  if (lower.includes("simulation failed") || lower.includes("custom program error")) {
    return { reason: "tx_execution_failed", message: `Simulation/execution failed: ${msg}` };
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return { reason: "tx_send_failed", message: `RPC rate limit hit: ${msg}` };
  }

  return { reason: "unknown", message: msg };
}

// ── Public swap executor ───────────────────────────────────────────────────

/**
 * Execute a swap using Solana Agent Kit methods.trade().
 *
 * Applying Patch C:
 * - Converts lamports to SOL amount units.
 * - Converts mint strings to PublicKey.
 * - Introspects trade() function length for compatibility.
 */
export async function executeSwap(
  ctx: SolanaContext,
  params: PlanSwapParams
): Promise<ExecutionResult> {
  const config = loadConfig();
  const maxRetries = config.maxTxRetries;
  const attempts: ExecutionAttempt[] = [];

  // Patch C: Prep units and types
  const amountSol = params.inputAmountLamports / 1e9;
  const toMintPk = new PublicKey(params.toMint);
  const fromMintPk = new PublicKey(params.fromMint);

  logger.info(
    `Executing swap: ${amountSol.toFixed(6)} SOL equivalent ` +
    `(${params.fromMint.slice(0, 8)}... → ${params.toMint.slice(0, 8)}...) ` +
    `slippage=${params.slippageBps}bps`
  );

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const startedAt = nowIso();
    logger.info(`Swap attempt ${attempt}/${maxRetries + 1}...`);

    try {
      // ── Call Agent Kit trade() ──────────────────────────────────────────
      // Signature: trade(agent, outputMint, inputAmount, inputMint, slippageBps)
      // Patch C: handle both 4-arg and 5-arg (context-included) versions.
      const tradeFn = ctx.agent.methods.trade as any;
      const txSignature = await (tradeFn.length >= 5
        ? tradeFn(ctx.agent, toMintPk, amountSol, fromMintPk, params.slippageBps)
        : tradeFn(toMintPk, amountSol, fromMintPk, params.slippageBps)) as string;

      const finishedAt = nowIso();

      attempts.push({
        attemptNumber: attempt,
        startedAt,
        finishedAt,
        success: true,
        txSignature,
      });

      logger.success(`Swap confirmed: ${txSignature}`);
      logger.info(`Explorer: ${solanaExplorerTxUrl(txSignature, config.solanaNetwork)}`);

      return {
        status: "success",
        txSignature,
        confirmedAt: finishedAt,
        explorerUrl: solanaExplorerTxUrl(txSignature, config.solanaNetwork),
        solscanUrl: solscanTxUrl(txSignature, config.solanaNetwork),
        attempts,
        lamportsSpent: params.inputAmountLamports,
        isSimulation: false,
      };

    } catch (err) {
      const finishedAt = nowIso();
      const { reason, message } = classifySwapError(err);

      logger.warn(`Swap attempt ${attempt} failed [${reason}]: ${message}`);

      attempts.push({
        attemptNumber: attempt,
        startedAt,
        finishedAt,
        success: false,
        errorMessage: message,
        errorCode: reason,
      });

      // Don't retry if it's a hard failure
      const hardFailures: ExecutionFailureReason[] = [
        "tx_execution_failed",
        "pre_flight_denied",
      ];
      if (hardFailures.includes(reason)) {
        logger.error(`Hard failure — not retrying: ${reason}`);
        return {
          status: "failure",
          reason,
          message,
          attempts,
          isSimulation: false,
        };
      }

      // Wait before retry
      if (attempt <= maxRetries) {
        logger.info(`Waiting ${RETRY_DELAY_MS}ms before retry...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  // All retries exhausted
  const lastAttempt = attempts[attempts.length - 1];
  return {
    status: "failure",
    reason: "max_retries_exceeded",
    message:
      `Swap failed after ${attempts.length} attempt(s). ` +
      `Last error: ${lastAttempt?.errorMessage ?? "unknown"}`,
    attempts,
    isSimulation: false,
  };
}
