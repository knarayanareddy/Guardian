import type { SolanaContext } from "../solana/makeAgent";
import { sendMemoTx } from "../solana/memo";
import { solanaExplorerTxUrl, solscanTxUrl } from "../solana/explorerLinks";
import { loadConfig } from "../config/loadConfig";
import { nowIso } from "../utils/time";
import { logger } from "../utils/logger";
import type { ReceiptAnchor } from "./receipt.schema";

export function buildReceiptMemo(receiptHash: string): string {
  // Keep it short and strict for easy parsing
  return `guardian_receipt:v1:${receiptHash}`;
}

export async function anchorReceipt(params: {
  ctx: SolanaContext;
  receiptHash: string;
}): Promise<ReceiptAnchor> {
  const config = loadConfig();
  const memo = buildReceiptMemo(params.receiptHash);

  logger.info(`Anchoring receipt via memo: ${memo.slice(0, 72)}...`);

  const { signature } = await sendMemoTx({
    connection: params.ctx.connection,
    payer: params.ctx.keypair,
    memo,
  });

  const anchor: ReceiptAnchor = {
    anchoredAt: nowIso(),
    memo,
    anchorTxSignature: signature,
    explorerUrl: solanaExplorerTxUrl(signature, config.solanaNetwork),
    solscanUrl: solscanTxUrl(signature, config.solanaNetwork),
  };

  logger.success(`Receipt anchored: ${signature}`);
  return anchor;
}
