import type { Plan } from "../planner/plan.schema";
import type { PolicyDecision } from "../policy/policy.engine.types";
import type { WalletSnapshot } from "../state/snapshot.schema";
import type { RiskReport } from "../risk/risk.types";

// ── Routing decision ───────────────────────────────────────────────────────

/**
 * What the approval engine decides to do with a plan.
 */
export type ApprovalRouting =
  | "auto_approved"    // approvalMode=policyOnly + status=ALLOWED → no human needed
  | "needs_human"      // must ask a human before proceeding
  | "auto_denied"      // policy said DENIED — no point asking human
  | "yolo"             // approvalMode=never (devnet only) → skip all prompts
  | "no_action_needed"; // plan.actionType is "none" or "halt"

// ── Human decision ─────────────────────────────────────────────────────────

export type HumanDecision =
  | "approved"  // human said yes
  | "rejected"  // human said no
  | "aborted";  // human aborted the session (ctrl+c or 'abort')

// ── Approval request ───────────────────────────────────────────────────────

/**
 * Everything needed to present an approval prompt and record its outcome.
 */
export interface ApprovalRequest {
  requestId: string;          // unique id, e.g. "appr-YYYYMMDD-HHmmss"
  createdAt: string;          // ISO UTC

  plan: Plan;
  policyDecision: PolicyDecision;
  snapshot: WalletSnapshot;
  riskReport: RiskReport;

  approvalMode: string;       // from config
  routing: ApprovalRouting;
}

// ── Approval decision (the outcome) ───────────────────────────────────────

export interface ApprovalDecision {
  requestId: string;
  decidedAt: string;          // ISO UTC

  routing: ApprovalRouting;
  humanDecision?: HumanDecision; // only set if routing === "needs_human"

  approved: boolean;          // final gate: true = proceed to execution
  reason: string;             // human-readable reason for the decision

  // Who/what approved
  approvedBy:
    | "human_cli"
    | "auto_policy"
    | "auto_yolo"
    | "auto_no_action"
    | "auto_denied"
    | "human_rejected"
    | "human_aborted";
}

// ── Persisted record ───────────────────────────────────────────────────────

/**
 * What gets written to data/approvals.json.
 * Combines request + decision for a complete audit record.
 */
export interface ApprovalRecord {
  request: ApprovalRequest;
  decision: ApprovalDecision;
}
