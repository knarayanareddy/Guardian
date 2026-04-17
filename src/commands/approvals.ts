import chalk from "chalk";
import { getRecentApprovals, formatApprovalsSummary, getApprovalById } from "../approvals/approval.store";
import { formatApprovalRequest } from "../approvals/approval.format";
import { logger } from "../utils/logger";

// ── guardian approvals list ────────────────────────────────────────────────

export async function runApprovalsList(opts: { n?: string }): Promise<void> {
  logger.section("Recent Approvals");

  const n = Math.min(Math.max(Number(opts.n ?? "20"), 1), 200);
  const records = getRecentApprovals(n);

  logger.raw(formatApprovalsSummary(records));
  logger.blank();

  if (records.length > 0) {
    const approved = records.filter((r) => r.decision.approved).length;
    const rejected = records.filter((r) => !r.decision.approved).length;
    logger.raw(
      chalk.green(`  Approved: ${approved}`) +
      "  " +
      chalk.red(`Rejected / Denied / Aborted: ${rejected}`)
    );
    logger.blank();
  }
}

// ── guardian approvals show <requestId> ───────────────────────────────────

export async function runApprovalsShow(requestId: string): Promise<void> {
  logger.section(`Approval Record: ${requestId}`);

  const record = getApprovalById(requestId);
  if (!record) {
    logger.error(`No approval record found with ID: ${requestId}`);
    process.exit(1);
  }

  logger.raw(formatApprovalRequest(record.request));
  logger.blank();

  const d = record.decision;
  const status = d.approved
    ? chalk.green("✓ APPROVED")
    : chalk.red("✗ NOT APPROVED");

  logger.raw(`  Decision   : ${status}`);
  logger.raw(`  Decided at : ${d.decidedAt}`);
  logger.raw(`  Approved by: ${d.approvedBy}`);
  logger.raw(`  Reason     : ${d.reason}`);
  if (d.humanDecision) {
    logger.raw(`  Human input: ${d.humanDecision}`);
  }
  logger.blank();
}
