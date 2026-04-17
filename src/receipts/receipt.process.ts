import type { SolanaContext } from "../solana/makeAgent";
import type { Plan } from "../planner/plan.schema";
import type { PolicyDecision } from "../policy/policy.engine.types";
import type { ExecutionSuccess } from "../execute/execute.types";
import { buildReceiptRecord } from "./receipt.build";
import { saveReceiptRecord } from "./receipt.store";
import { anchorReceipt } from "./receipt.anchor";
import { writeWikiForReceipt } from "../wiki/wiki.write";
import { anchorWikiHash } from "../wiki/wiki.anchor";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";

/**
 * End-to-end receipt processing:
 *   1) build deterministic payload
 *   2) compute hash
 *   3) save receipt record to disk
 *   4) anchor hash via memo tx
 *   5) save receipt again including anchor info
 *   6) write wiki receipt page + run rollup
 */
export async function processReceipt(params: {
  ctx: SolanaContext;
  plan: Plan;
  policyDecision: PolicyDecision;
  execution: ExecutionSuccess;
  approvalRequestId: string;

  runId?: string;

  preSnapshot: {
    snapshotId: string;
    timestamp: string;
    solLamports: number;
    solBalance: number;
    estimatedPortfolioUsd: number;
  };
}): Promise<{
  receiptHash: string;
  anchorTxSignature: string;
  wikiReceiptPath: string;
}> {
  logger.section("Receipt Processing");

  // 1) Build payload + hash
  let record = await buildReceiptRecord({
    ctx: params.ctx,
    plan: params.plan,
    policyDecision: params.policyDecision,
    execution: params.execution,
    approvalRequestId: params.approvalRequestId,
    preSnapshotId: params.preSnapshot.snapshotId,
    preSnapshot: params.preSnapshot,
  });

  // 2) Save receipt (no anchor yet)
  saveReceiptRecord(record);

  // 3) Anchor on-chain via memo
  const anchor = await anchorReceipt({
    ctx: params.ctx,
    receiptHash: record.receiptHash,
  });

  // 4) Save again including anchor
  record = { ...record, anchor };
  saveReceiptRecord(record);

  // 5) Write wiki (receipt page + run rollup)
  const wiki = writeWikiForReceipt({
    receiptHash: record.receiptHash,
    record,
    runId: params.runId,
  });

  // Attach wiki metadata to receipt record
  record = {
    ...record,
    wiki: {
      receiptWikiPath: wiki.receiptWikiPath,
      receiptWikiHash: wiki.receiptWikiHash,
    },
  };

  saveReceiptRecord(record);

  // 6) Optional: anchor wiki hash on-chain
  const config = loadConfig();
  if (config.wikiHashAnchorEnabled) {
    const wikiAnchor = await anchorWikiHash({
      ctx: params.ctx,
      receiptHash: record.receiptHash,
      wikiHash: wiki.receiptWikiHash,
    });

    record = {
      ...record,
      wiki: {
        ...record.wiki!,
        wikiAnchor,
      },
    };

    saveReceiptRecord(record);
    logger.success(`Wiki hash anchored: ${wikiAnchor.wikiAnchorTxSignature}`);
  }

  logger.success(`Receipt finalized: ${record.receiptHash}`);
  logger.info(`Anchor tx: ${anchor.anchorTxSignature}`);

  return {
    receiptHash: record.receiptHash,
    anchorTxSignature: anchor.anchorTxSignature,
    wikiReceiptPath: wiki.receiptWikiPath,
  };
}
