import * as fs from "fs";
import * as path from "path";
import type { ApprovalRecord, ApprovalDecision, ApprovalRequest } from "./approval.types";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";

// ── Helpers ────────────────────────────────────────────────────────────────

function getApprovalsPath(): string {
  const config = loadConfig();
  return path.join(config.dataDir, "approvals.json");
}

// ── Load ───────────────────────────────────────────────────────────────────

export function loadApprovals(): ApprovalRecord[] {
  const p = getApprovalsPath();
  if (!fs.existsSync(p)) return [];

  const raw = fs.readFileSync(p, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("approvals.json is malformed. Starting fresh.");
    return [];
  }

  if (!Array.isArray(parsed)) {
    logger.warn("approvals.json is not an array. Starting fresh.");
    return [];
  }

  return parsed as ApprovalRecord[];
}

// ── Save ───────────────────────────────────────────────────────────────────

function saveApprovals(records: ApprovalRecord[]): void {
  const p = getApprovalsPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(records, null, 2), "utf8");
}

// ── Append ─────────────────────────────────────────────────────────────────

/**
 * Persist a completed approval record (request + decision) to disk.
 * Called by the approval engine after every routing decision,
 * whether human-approved, auto-approved, rejected, or denied.
 */
export function appendApprovalRecord(
  request: ApprovalRequest,
  decision: ApprovalDecision
): ApprovalRecord {
  const record: ApprovalRecord = { request, decision };
  const all = loadApprovals();
  all.push(record);
  saveApprovals(all);

  logger.debug(
    `Approval record saved: ${request.requestId} → ${decision.approved ? "APPROVED" : "NOT APPROVED"}`
  );

  return record;
}

// ── Query ──────────────────────────────────────────────────────────────────

/**
 * Return most recent N approval records (newest first).
 */
export function getRecentApprovals(n = 20): ApprovalRecord[] {
  const all = loadApprovals();
  return all.slice(-n).reverse();
}

/**
 * Return the approval record for a specific requestId.
 */
export function getApprovalById(requestId: string): ApprovalRecord | undefined {
  return loadApprovals().find((r) => r.request.requestId === requestId);
}

// ── Format ─────────────────────────────────────────────────────────────────

export function formatApprovalsSummary(records: ApprovalRecord[]): string {
  if (records.length === 0) return "No approval records found.";

  const lines = [
    `${records.length} approval record(s) (most recent first):`,
    "",
  ];

  for (const r of records) {
    const { request: req, decision: dec } = r;
    // Applying Patch E: use dec.humanDecision directly
    const status = dec.approved
      ? "✓ APPROVED"
      : dec.humanDecision === "rejected"
      ? "✗ REJECTED"
      : dec.humanDecision === "aborted"
      ? "◌ ABORTED"
      : "✗ DENIED";

    lines.push(
      `  [${req.createdAt}]  ${status.padEnd(12)}` +
      `  ${req.plan.label.slice(0, 50).padEnd(52)}` +
      `  by=${dec.approvedBy}`
    );
  }

  return lines.join("\n");
}
