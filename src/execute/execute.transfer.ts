import type { SolanaContext } from "../solana/makeAgent";
import type { PlanTransferParams } from "../planner/plan.schema";
import type {
  ExecutionResult,
  ExecutionAttempt,
  ExecutionFailureReason,
} from "./execute.types";
import { solanaExplorerTxUrl, solscanTxUrl } from "../solana/explorerLinks";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";
import { nowIso, sleep } from "../utils/time";

// ── Retry config ───────────────────────────────────────────────────────────

const RETRY_DELAY_MS = 2_000;

// ── Error classification ───────────────────────────────────────────────────

function classifyTransferError(err: unknown): {
  reason: ExecutionFailureReason;
  message: string;
} {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("blockhash")) {
    return { reason: "tx_send_failed", message: `Blockhash expired: ${msg}` };
  }
  if (lower.includes("insufficient funds") || lower.includes("insufficient lamports")) {
    return { reason: "tx_execution_failed", message: `Insufficient funds: ${msg}` };
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return { reason: "tx_confirm_timeout", message: `Confirmation timeout: ${msg}` };
  }
  if (lower.includes("invalid account") || lower.includes("invalid address")) {
    return { reason: "tx_execution_failed", message: `Invalid destination: ${msg}` };
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return { reason: "tx_send_failed", message: `RPC rate limit: ${msg}` };
  }

  return { reason: "unknown", message: msg };
}

// ── Public transfer executor ───────────────────────────────────────────────

/**
 * Execute a SOL transfer using Solana Agent Kit methods.transfer().
 *
 * Applying Patch D:
 * - Enforces SOL-only transfers in the MVP.
 * - Handles both 2-arg and 3-arg (context-included) versions of transfer().
 */
export async function executeTransfer(
  ctx: SolanaContext,
  params: PlanTransferParams
): Promise<ExecutionResult> {
  const config = loadConfig();
  const maxRetries = config.maxTxRetries;
  const attempts: ExecutionAttempt[] = [];

  // Patch D: MVP: SOL-only transfers to avoid SPL decimals/unit ambiguity.
  if (!(params.mint === "SOL" || params.mint === "native")) {
    return {
      status: "failure",
      reason: "pre_flight_denied",
      message: "MVP supports SOL transfers only. For SPL, implement decimal-aware token-unit transfers.",
      attempts: [],
      isSimulation: false,
    };
  }

  // Convert lamports to SOL for the transfer call
  const amountSol = params.amountLamports / 1e9;

  logger.info(
    `Executing transfer: ${amountSol.toFixed(6)} SOL → ` +
    `${params.destinationAddress.slice(0, 12)}...`
  );

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const startedAt = nowIso();
    logger.info(`Transfer attempt ${attempt}/${maxRetries + 1}...`);

    try {
      // ── Call Agent Kit transfer() ───────────────────────────────────────
      // Patch D: Introspect function length for compatibility.
      const transferFn = ctx.agent.methods.transfer as any;
      const txSignature = await (transferFn.length >= 3
        ? transferFn(ctx.agent, params.destinationAddress, amountSol)
        : transferFn(params.destinationAddress, amountSol)) as string;

      const finishedAt = nowIso();

      attempts.push({
        attemptNumber: attempt,
        startedAt,
        finishedAt,
        success: true,
        txSignature,
      });

      logger.success(`Transfer confirmed: ${txSignature}`);
      logger.info(`Explorer: ${solanaExplorerTxUrl(txSignature, config.solanaNetwork)}`);

      return {
        status: "success",
        txSignature,
        confirmedAt: finishedAt,
        explorerUrl: solanaExplorerTxUrl(txSignature, config.solanaNetwork),
        solscanUrl: solscanTxUrl(txSignature, config.solanaNetwork),
        attempts,
        lamportsSpent: params.amountLamports,
        isSimulation: false,
      };

    } catch (err) {
      const finishedAt = nowIso();
      const { reason, message } = classifyTransferError(err);

      logger.warn(`Transfer attempt ${attempt} failed [${reason}]: ${message}`);

      attempts.push({
        attemptNumber: attempt,
        startedAt,
        finishedAt,
        success: false,
        errorMessage: message,
        errorCode: reason,
      });

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

      if (attempt <= maxRetries) {
        logger.info(`Waiting ${RETRY_DELAY_MS}ms before retry...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  const lastAttempt = attempts[attempts.length - 1];
  return {
    status: "failure",
    reason: "max_retries_exceeded",
    message:
      `Transfer failed after ${attempts.length} attempt(s). ` +
      `Last error: ${lastAttempt?.errorMessage ?? "unknown"}`,
    attempts,
    isSimulation: false,
  };
}
