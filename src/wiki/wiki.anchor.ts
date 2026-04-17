import type { SolanaContext } from "../solana/makeAgent";
import { sendMemoTx } from "../solana/memo";
import { solanaExplorerTxUrl, solscanTxUrl } from "../solana/explorerLinks";
import { loadConfig } from "../config/loadConfig";
import { nowIso } from "../utils/time";
import { logger } from "../utils/logger";

export interface WikiAnchorResult {
  anchoredAt: string;
  memo: string;
  wikiAnchorTxSignature: string;
  explorerUrl: string;
  solscanUrl: string;
}

export function buildWikiMemo(receiptHash: string, wikiHash: string): string {
  return `guardian_wiki:v1:${receiptHash}:${wikiHash}`;
}

export async function anchorWikiHash(params: {
  ctx: SolanaContext;
  receiptHash: string;
  wikiHash: string;
}): Promise<WikiAnchorResult> {
  const config = loadConfig();
  const memo = buildWikiMemo(params.receiptHash, params.wikiHash);

  logger.info(`Anchoring wiki hash via memo: ${memo.slice(0, 80)}...`);

  const { signature } = await sendMemoTx({
    connection: params.ctx.connection,
    payer: params.ctx.keypair,
    memo,
  });

  return {
    anchoredAt: nowIso(),
    memo,
    wikiAnchorTxSignature: signature,
    explorerUrl: solanaExplorerTxUrl(signature, config.solanaNetwork),
    solscanUrl: solscanTxUrl(signature, config.solanaNetwork),
  };
}
