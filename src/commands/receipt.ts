import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { makeSolanaContext } from "../solana/makeAgent";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";
import { listReceipts, loadReceiptRecord, verifyReceiptRecordHash } from "../receipts/receipt.store";
import { processReceipt } from "../receipts/receipt.process";
import { loadPendingReceipt, clearPendingReceipt } from "../receipts/pending.store";
import { checkPlanAgainstPolicy } from "../policy/policy.plan.bridge";
import { loadPlan } from "../planner/plan.store";

export async function runReceiptList(opts: { n?: string }): Promise<void> {
  logger.section("Receipts (latest)");

  const n = Math.min(Math.max(Number(opts.n ?? "20"), 1), 200);
  const hashes = listReceipts(n);

  if (hashes.length === 0) {
    logger.raw("No receipts found.");
    logger.blank();
    return;
  }

  for (const h of hashes) {
    logger.raw(`- ${h}`);
  }
  logger.blank();
}

export async function runReceiptShow(hash: string): Promise<void> {
  logger.section(`Receipt: ${hash}`);

  const rec = loadReceiptRecord(hash);
  if (!rec) {
    logger.error("Receipt not found.");
    process.exit(1);
  }

  const verify = verifyReceiptRecordHash(hash);
  if (!verify.ok) {
    logger.warn(`Receipt hash verification FAILED: ${verify.error} computed=${verify.computed}`);
  } else {
    logger.success("Receipt hash verification OK.");
  }

  logger.blank();
  logger.raw(chalk.bold("Payload summary:"));
  logger.raw(`  createdAt   : ${rec.payload.createdAt}`);
  logger.raw(`  network     : ${rec.payload.network}`);
  logger.raw(`  agentWallet : ${rec.payload.agentWallet}`);
  logger.raw(`  policyHash  : ${rec.payload.policyHash.slice(0, 16)}...`);
  logger.raw(`  plan        : ${rec.payload.plan.planId} — ${rec.payload.plan.label}`);
  logger.raw(`  action tx   : ${rec.payload.execution.actionTxSignature}`);
  logger.raw(`  explorer    : ${rec.payload.execution.explorerUrl}`);
  logger.raw("");

  if (rec.anchor) {
    logger.raw(chalk.bold("Anchor:"));
    logger.raw(`  memo tx     : ${rec.anchor.anchorTxSignature}`);
    logger.raw(`  memo        : ${rec.anchor.memo}`);
    logger.raw(`  explorer    : ${rec.anchor.explorerUrl}`);
  } else {
    logger.warn("No on-chain anchor recorded in this receipt.");
  }

  logger.blank();

  const config = loadConfig();
  const wikiPath = path.join(config.wikiDir, "receipts", `${hash}.md`);
  if (fs.existsSync(wikiPath)) {
    logger.success(`Wiki page: ${wikiPath}`);
  } else {
    logger.warn(`Wiki page missing: ${wikiPath}`);
  }
}

export async function runReceiptProcess(): Promise<void> {
  logger.section("Process Pending Receipt");

  const pending = loadPendingReceipt();
  if (!pending) {
    logger.warn("No pending receipt found (data/pending-receipt.json missing).");
    logger.raw("Run: guardian run --once  (real execution) to generate one.");
    logger.blank();
    return;
  }

  const ctx = makeSolanaContext();

  // Re-load plan from disk
  const plan = loadPlan(pending.planId);
  if (!plan) {
    logger.error(`Could not load plan: ${pending.planId}`);
    return;
  }

  // Re-check policy (defense-in-depth)
  const policyDecision = checkPlanAgainstPolicy(plan);

  // Pre-snapshot is not stored in pending file in Phase 7, so we approximate with post snapshot fields.
  // Better: Phase 9+10 can store full pre-snapshot. For now, we use pending.plan + current data.
  // To keep receipts consistent, Phase 7 will now pass preSnapshot directly when processing immediately.
  logger.warn(
    "Processing pending receipt without original pre-snapshot (MVP limitation). " +
    "Receipt will use best-effort snapshot values."
  );

  const preSnapshot = {
    snapshotId: pending.snapshotId,
    timestamp: pending.confirmedAt,
    solLamports: 0,
    solBalance: 0,
    estimatedPortfolioUsd: 0,
  };

  const pendingExecutionResult = {
    isSimulation: false,
    txSignature: pending.actionTxSignature,
    confirmedAt: pending.confirmedAt,
    lamportsSpent: pending.lamportsSpent,
    explorerUrl: "", // reconstructed inside receipt build
    solscanUrl: "",
    reason: "",
    message: "",
  };

  const out = await processReceipt({
    ctx,
    plan,
    policyDecision,
    execution: pendingExecutionResult as any,
    approvalRequestId: pending.approvalRequestId,
    preSnapshot,
  });

  clearPendingReceipt();

  logger.success(`Processed receipt: ${out.receiptHash}`);
  logger.info(`Anchored by memo tx: ${out.anchorTxSignature}`);
  logger.blank();
}
