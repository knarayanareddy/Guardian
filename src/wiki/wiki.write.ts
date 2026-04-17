import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "../config/loadConfig";
import type { ReceiptRecord } from "../receipts/receipt.schema";
import { hashMarkdown } from "./wiki.hash";
import { logger } from "../utils/logger";

export interface WikiWriteResult {
  receiptWikiPath: string;
  runWikiPath?: string;
  receiptWikiHash: string;
}

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function receiptWikiPath(receiptHash: string): string {
  const config = loadConfig();
  return path.join(config.wikiDir, "receipts", `${receiptHash}.md`);
}

function runWikiPath(runId: string): string {
  const config = loadConfig();
  return path.join(config.wikiDir, "runs", `${runId}.md`);
}

function indexPath(): string {
  const config = loadConfig();
  return path.join(config.wikiDir, "INDEX.md");
}

function policyLinkPath(): string {
  const config = loadConfig();
  return path.join(config.wikiDir, "policies", "current.md");
}

/**
 * Render a receipt into a human-readable markdown page.
 */
export function renderReceiptMarkdown(params: {
  receiptHash: string;
  record: ReceiptRecord;
  runId?: string;
}): string {
  const { receiptHash, record, runId } = params;
  const p = record.payload;
  const a = record.anchor;

  const lines: string[] = [];

  lines.push(`# Receipt ${receiptHash}`);
  lines.push("");
  lines.push(`- **Created:** ${p.createdAt}`);
  lines.push(`- **Network:** ${p.network}`);
  lines.push(`- **Agent wallet:** \`${p.agentWallet}\``);
  if (runId) lines.push(`- **Run ID:** \`${runId}\``);
  lines.push(`- **Policy hash:** \`${p.policyHash}\``);
  lines.push(`- **Policy status at plan:** **${p.policyDecisionStatus}**`);
  lines.push(`- **Spent today at plan time:** ${(p.todaySpentLamportsAtPlan / 1e9).toFixed(6)} SOL`);
  lines.push("");

  lines.push(`## Plan`);
  lines.push(`- **Plan ID:** \`${p.plan.planId}\``);
  lines.push(`- **Label:** ${p.plan.label}`);
  lines.push(`- **Action type:** **${p.plan.actionType}**`);
  lines.push(`- **Confidence:** ${(p.plan.confidence * 100).toFixed(0)}%`);
  lines.push(`- **Trigger reason:** \`${p.plan.triggerReason}\``);
  if (p.plan.receiptTags?.length) {
    lines.push(`- **Tags:** ${p.plan.receiptTags.map((t) => `\`#${t}\``).join(" ")}`);
  }
  lines.push("");

  if (p.plan.actionType === "swap" && p.plan.swapParams) {
    lines.push(`### Swap params`);
    lines.push(`- fromMint: \`${p.plan.swapParams.fromMint}\``);
    lines.push(`- toMint: \`${p.plan.swapParams.toMint}\``);
    lines.push(`- inputAmount: ${(p.plan.swapParams.inputAmountLamports / 1e9).toFixed(6)} SOL (${p.plan.swapParams.inputAmountLamports} lamports)`);
    lines.push(`- slippage: ${p.plan.swapParams.slippageBps} bps (${(p.plan.swapParams.slippageBps / 100).toFixed(2)}%)`);
    lines.push("");
  }

  if (p.plan.actionType === "transfer" && p.plan.transferParams) {
    lines.push(`### Transfer params`);
    lines.push(`- mint: \`${p.plan.transferParams.mint}\``);
    lines.push(`- destination: \`${p.plan.transferParams.destinationAddress}\``);
    lines.push(`- amount: ${(p.plan.transferParams.amountLamports / 1e9).toFixed(6)} SOL (${p.plan.transferParams.amountLamports} lamports)`);
    lines.push("");
  }

  lines.push(`## Approval`);
  lines.push(`- **Approval request ID:** \`${p.approval.approvalRequestId}\``);
  lines.push(`- **Approved by:** \`${p.approval.approvedBy}\``);
  lines.push(`- **Decided at:** ${p.approval.decidedAt}`);
  lines.push(`- **Reason:** ${p.approval.reason}`);
  lines.push("");

  lines.push(`## Execution`);
  lines.push(`- **Action tx:** \`${p.execution.actionTxSignature}\``);
  lines.push(`- **Confirmed at:** ${p.execution.confirmedAt}`);
  lines.push(`- **Lamports spent:** ${(p.execution.lamportsSpent / 1e9).toFixed(6)} SOL (${p.execution.lamportsSpent} lamports)`);
  lines.push(`- **Explorer:** ${p.execution.explorerUrl}`);
  lines.push(`- **Solscan:** ${p.execution.solscanUrl}`);
  lines.push("");

  lines.push(`## On-chain receipt anchor (SPL Memo)`);
  if (!a) {
    lines.push(`- **Anchor:** (missing)`);
  } else {
    lines.push(`- **Memo tx:** \`${a.anchorTxSignature}\``);
    lines.push(`- **Memo:** \`${a.memo}\``);
    lines.push(`- **Explorer:** ${a.explorerUrl}`);
    lines.push(`- **Solscan:** ${a.solscanUrl}`);
  }
  lines.push("");

  lines.push(`## Snapshots`);
  lines.push(`### Pre-snapshot`);
  lines.push(`- snapshotId: \`${p.preSnapshot.snapshotId}\``);
  lines.push(`- timestamp: ${p.preSnapshot.timestamp}`);
  lines.push(`- SOL: ${(p.preSnapshot.solBalance).toFixed(6)} (${p.preSnapshot.solLamports} lamports)`);
  lines.push(`- est. USD: $${p.preSnapshot.estimatedPortfolioUsd.toFixed(2)}`);
  lines.push("");

  if (p.postSnapshot) {
    lines.push(`### Post-snapshot`);
    lines.push(`- snapshotId: \`${p.postSnapshot.snapshotId}\``);
    lines.push(`- timestamp: ${p.postSnapshot.timestamp}`);
    lines.push(`- SOL: ${(p.postSnapshot.solBalance).toFixed(6)} (${p.postSnapshot.solLamports} lamports)`);
    lines.push(`- est. USD: $${p.postSnapshot.estimatedPortfolioUsd.toFixed(2)}`);
    lines.push("");
  } else {
    lines.push(`### Post-snapshot`);
    lines.push(`- (not recorded)`);
    lines.push("");
  }

  // Include payload for forensic auditing (still human-readable)
  lines.push(`## Receipt payload (verifiable)`);
  lines.push(`This exact JSON payload is what was hashed into \`${receiptHash}\` and anchored on-chain.`);
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(record.payload, null, 2));
  lines.push("```");
  lines.push("");

  lines.push(`---`);
  lines.push(`- Wiki page hash (sha256 of markdown) will be computed locally at write time.`);
  lines.push(`- Policy page: ${path.relative(path.dirname(receiptWikiPath(receiptHash)), policyLinkPath()).replace(/\\/g, "/")}`);

  return lines.join("\n");
}

/**
 * Ensure wiki INDEX.md contains a link to this receipt.
 * Idempotent: will not add duplicates.
 */
function upsertIndexReceiptLink(receiptHash: string): void {
  const p = indexPath();
  if (!fs.existsSync(p)) return;

  const linkLine = `- <!--citation:1-->`;
  const raw = fs.readFileSync(p, "utf8");

  if (raw.includes(linkLine)) return;

  // Add a Receipts section if missing
  let updated = raw;
  if (!updated.includes("## Receipts")) {
    updated += `\n\n## Receipts\n`;
  }
  updated += `\n${linkLine}\n`;

  fs.writeFileSync(p, updated, "utf8");
}

/**
 * Write or update a run rollup file.
 * Appends a receipt link (idempotent per receiptHash).
 */
function upsertRunRollup(runId: string, receiptHash: string, createdAt: string): string {
  const p = runWikiPath(runId);
  ensureDir(path.dirname(p));

  const linkLine = `- [receipt ${receiptHash}](../receipts/${receiptHash}.md)`;
  const header = `# Run ${runId}\n\n- **Created:** ${createdAt}\n\n## Receipts\n`;

  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, header + `${linkLine}\n`, "utf8");
    return p;
  }

  const raw = fs.readFileSync(p, "utf8");
  if (raw.includes(linkLine)) return p;

  let updated = raw;
  if (!updated.includes("## Receipts")) {
    updated += `\n\n## Receipts\n`;
  }
  updated += `\n${linkLine}\n`;

  fs.writeFileSync(p, updated, "utf8");
  return p;
}

/**
 * Main entry point: write receipt wiki page, update INDEX, optionally update run rollup.
 */
export function writeWikiForReceipt(params: {
  receiptHash: string;
  record: ReceiptRecord;
  runId?: string;
}): WikiWriteResult {
  const config = loadConfig();
  ensureDir(config.wikiDir);
  ensureDir(path.join(config.wikiDir, "receipts"));
  ensureDir(path.join(config.wikiDir, "runs"));
  ensureDir(path.join(config.wikiDir, "policies"));

  const md = renderReceiptMarkdown(params);
  const mdHash = hashMarkdown(md);

  const receiptPath = receiptWikiPath(params.receiptHash);
  fs.writeFileSync(receiptPath, md, "utf8");
  logger.success(`Wiki receipt written: ${receiptPath}`);
  logger.info(`Wiki receipt hash: ${mdHash}`);

  upsertIndexReceiptLink(params.receiptHash);

  let runPath: string | undefined;
  if (params.runId) {
    runPath = upsertRunRollup(params.runId, params.receiptHash, params.record.payload.createdAt);
    logger.success(`Wiki run rollup updated: ${runPath}`);
  }

  return {
    receiptWikiPath: receiptPath,
    runWikiPath: runPath,
    receiptWikiHash: mdHash,
  };
}
