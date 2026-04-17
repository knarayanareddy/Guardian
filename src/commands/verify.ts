import chalk from "chalk";
import { makeSolanaContext } from "../solana/makeAgent";
import { MEMO_PROGRAM_ID } from "../solana/memo";
import { buildReceiptMemo } from "../receipts/receipt.anchor";
import { loadReceiptRecord, verifyReceiptRecordHash } from "../receipts/receipt.store";
import { logger } from "../utils/logger";
import { loadConfig } from "../config/loadConfig";
import * as fs from "fs";
import * as path from "path";

type VerifyStatus = "OK" | "WARN" | "FAIL";

function statusLine(status: VerifyStatus, label: string, detail: string): void {
  const c =
    status === "OK" ? chalk.green :
    status === "WARN" ? chalk.yellow :
    chalk.red;

  const icon = status === "OK" ? "✓" : status === "WARN" ? "⚠" : "✗";
  logger.raw(c(`${icon} ${label}: ${detail}`));
}

export async function runVerifyReceipt(receiptHash: string): Promise<void> {
  logger.section(`Verify Receipt: ${receiptHash}`);

  const config = loadConfig();
  const ctx = makeSolanaContext();

  // ── 1) Load receipt record ───────────────────────────────────────────────
  const rec = loadReceiptRecord(receiptHash);
  if (!rec) {
    statusLine("FAIL", "Local receipt", "Not found");
    process.exit(1);
  }
  statusLine("OK", "Local receipt", "Found");

  // ── 2) Verify local hash matches payload ─────────────────────────────────
  const localVerify = verifyReceiptRecordHash(receiptHash);
  if (!localVerify.ok) {
    statusLine("FAIL", "Local hash", `Mismatch (${localVerify.error})`);
    process.exit(1);
  }
  statusLine("OK", "Local hash", "Matches payload");

  // ── 3) Check wiki page exists ───────────────────────────────────────────
  const wikiPath = path.join(config.wikiDir, "receipts", `${receiptHash}.md`);
  if (fs.existsSync(wikiPath)) {
    statusLine("OK", "Wiki page", `Exists (${wikiPath})`);
  } else {
    statusLine("WARN", "Wiki page", `Missing (${wikiPath})`);
  }

  // ── 4) Verify anchor memo tx ────────────────────────────────────────────
  if (!rec.anchor) {
    statusLine("FAIL", "Anchor", "Receipt has no anchor info");
    process.exit(1);
  }

  const expectedMemo = buildReceiptMemo(receiptHash);
  statusLine("OK", "Expected memo", expectedMemo);

  // Fetch parsed transaction for anchor memo
  const anchorSig = rec.anchor.anchorTxSignature;
  const anchorTx = await ctx.connection.getParsedTransaction(anchorSig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!anchorTx) {
    statusLine("FAIL", "Anchor tx", `Not found on cluster (${config.solanaNetwork})`);
    process.exit(1);
  }
  statusLine("OK", "Anchor tx", "Found");

  if (anchorTx.meta?.err) {
    statusLine("FAIL", "Anchor tx status", `Failed: ${JSON.stringify(anchorTx.meta.err)}`);
    process.exit(1);
  }
  statusLine("OK", "Anchor tx status", "Success");

  // Extract memo instruction(s)
  const memoProgram = MEMO_PROGRAM_ID.toBase58();
  const memos: string[] = [];

  for (const ix of anchorTx.transaction.message.instructions) {
    // ParsedInstruction has: program, programId, parsed
    const programId = "programId" in ix ? ix.programId?.toBase58?.() : undefined;
    if (programId !== memoProgram) continue;

    // For memo program, parsed is usually a string.
    const parsed = (ix as any).parsed;
    if (typeof parsed === "string") memos.push(parsed);
    else if (parsed?.memo && typeof parsed.memo === "string") memos.push(parsed.memo);
  }

  if (memos.length === 0) {
    statusLine("FAIL", "Memo", "No memo instruction found in anchor tx");
    process.exit(1);
  } else {
    statusLine("OK", "Memo", `Found ${memos.length} memo(s)`);
  }

  const hasExpected = memos.some((m) => m.includes(expectedMemo));
  if (!hasExpected) {
    statusLine("FAIL", "Memo content", `Expected memo not found. memos=${JSON.stringify(memos)}`);
    process.exit(1);
  }
  statusLine("OK", "Memo content", "Matches expected receipt memo");

  // ── 5) Verify action tx exists and succeeded ─────────────────────────────
  const actionSig = rec.payload.execution.actionTxSignature;
  const actionTx = await ctx.connection.getParsedTransaction(actionSig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!actionTx) {
    statusLine("FAIL", "Action tx", "Not found");
    process.exit(1);
  }
  statusLine("OK", "Action tx", "Found");

  if (actionTx.meta?.err) {
    statusLine("FAIL", "Action tx status", `Failed: ${JSON.stringify(actionTx.meta.err)}`);
    process.exit(1);
  }
  statusLine("OK", "Action tx status", "Success");

  logger.blank();
  logger.success("Receipt verification complete: all required checks passed.");
  logger.blank();
}
