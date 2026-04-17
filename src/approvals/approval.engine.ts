import type {
  ApprovalRequest,
  ApprovalDecision,
  ApprovalRouting,
  HumanDecision,
} from "./approval.types";
import type { Plan } from "../planner/plan.schema";
import type { PolicyDecision } from "../policy/policy.engine.types";
import type { WalletSnapshot } from "../state/snapshot.schema";
import type { RiskReport } from "../risk/risk.types";
import { loadConfig } from "../config/loadConfig";
import { appendApprovalRecord } from "./approval.store";
import { formatApprovalRequest, formatApprovalOneLiner } from "./approval.format";
import { promptHumanApproval } from "./approval.cli";
import { logger } from "../utils/logger";
import { nowIso, makeRunId } from "../utils/time";

// ── Routing logic (deterministic) ─────────────────────────────────────────

/**
 * Determine the approval routing based on mode + policy decision + plan type.
 * Pure function — no side effects.
 */
function determineRouting(
  approvalMode: string,
  policyDecision: PolicyDecision,
  plan: Plan,
  network: string
): ApprovalRouting {

  // ── "none" or "halt" plans never need on-chain approval ─────────────────
  if (plan.actionType === "none" || plan.actionType === "halt") {
    return "no_action_needed";
  }

  // ── Hard policy denial overrides everything ──────────────────────────────
  if (policyDecision.status === "DENIED") {
    return "auto_denied";
  }

  // ── YOLO mode (never prompt) — devnet only ───────────────────────────────
  if (approvalMode === "never") {
    if (network !== "devnet") {
      // Safety override: if somehow never mode is set on non-devnet,
      // escalate to needs_human
      logger.warn(
        "APPROVAL_MODE=never is only allowed on devnet. " +
        "Escalating to needs_human for safety."
      );
      return "needs_human";
    }
    return "yolo";
  }

  // ── always mode → always ask ─────────────────────────────────────────────
  if (approvalMode === "always") {
    return "needs_human";
  }

  // ── policyOnly mode → ask only when policy says REQUIRES_APPROVAL ────────
  if (approvalMode === "policyOnly") {
    if (policyDecision.status === "REQUIRES_APPROVAL") {
      return "needs_human";
    }
    // ALLOWED + policyOnly → auto approve
    return "auto_approved";
  }

  // ── Unknown mode → safe default ──────────────────────────────────────────
  logger.warn(`Unknown approval mode: "${approvalMode}". Defaulting to needs_human.`);
  return "needs_human";
}

// ── Build approval request ─────────────────────────────────────────────────

function buildRequest(params: {
  plan: Plan;
  policyDecision: PolicyDecision;
  snapshot: WalletSnapshot;
  riskReport: RiskReport;
  routing: ApprovalRouting;
}): ApprovalRequest {
  const config = loadConfig();
  return {
    requestId: `appr-${makeRunId()}`,
    createdAt: nowIso(),
    plan: params.plan,
    policyDecision: params.policyDecision,
    snapshot: params.snapshot,
    riskReport: params.riskReport,
    approvalMode: config.approvalMode,
    routing: params.routing,
  };
}

// ── Auto decisions ─────────────────────────────────────────────────────────

function autoApproved(requestId: string): ApprovalDecision {
  return {
    requestId,
    decidedAt: nowIso(),
    routing: "auto_approved",
    approved: true,
    reason: "Policy status ALLOWED and approvalMode=policyOnly",
    approvedBy: "auto_policy",
  };
}

function autoDenied(requestId: string, policyDecision: PolicyDecision): ApprovalDecision {
  const reasons = policyDecision.violations.map((v) => v.detail).join("; ");
  return {
    requestId,
    decidedAt: nowIso(),
    routing: "auto_denied",
    approved: false,
    reason: `Policy DENIED: ${reasons}`,
    approvedBy: "auto_denied",
  };
}

function autoYolo(requestId: string): ApprovalDecision {
  logger.warn("YOLO mode: skipping approval prompt (devnet only).");
  return {
    requestId,
    decidedAt: nowIso(),
    routing: "yolo",
    approved: true,
    reason: "approvalMode=never (YOLO devnet mode)",
    approvedBy: "auto_yolo",
  };
}

function autoNoAction(requestId: string, plan: Plan): ApprovalDecision {
  return {
    requestId,
    decidedAt: nowIso(),
    routing: "no_action_needed",
    approved: false, // false because there's nothing to execute
    reason: `Plan actionType="${plan.actionType}" — no on-chain action required`,
    approvedBy: "auto_no_action",
  };
}

// ── Human approval flow ────────────────────────────────────────────────────

async function seekHumanApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
  // Show the full request
  logger.raw(formatApprovalRequest(request));

  const decision = await promptHumanApproval({
    promptText: `Approve plan "${request.plan.label}"?`,
    onShowDetails: () => {
      logger.raw(formatApprovalRequest(request));
    },
    timeoutSeconds: 120,
  });

  return humanDecisionToApprovalDecision(request.requestId, decision);
}

function humanDecisionToApprovalDecision(
  requestId: string,
  decision: HumanDecision
): ApprovalDecision {
  switch (decision) {
    case "approved":
      return {
        requestId,
        decidedAt: nowIso(),
        routing: "needs_human",
        humanDecision: "approved",
        approved: true,
        reason: "Human approved via CLI",
        approvedBy: "human_cli",
      };

    case "rejected":
      return {
        requestId,
        decidedAt: nowIso(),
        routing: "needs_human",
        humanDecision: "rejected",
        approved: false,
        reason: "Human rejected via CLI",
        approvedBy: "human_rejected",
      };

    case "aborted":
      return {
        requestId,
        decidedAt: nowIso(),
        routing: "needs_human",
        humanDecision: "aborted",
        approved: false,
        reason: "Human aborted session (ctrl+c or abort command)",
        approvedBy: "human_aborted",
      };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface ApprovalResult {
  request: ApprovalRequest;
  decision: ApprovalDecision;
  approved: boolean;
}

/**
 * Run the full approval flow for a plan.
 *
 * Steps:
 *   1. Determine routing (deterministic)
 *   2. Build approval request
 *   3. Route to: auto_approved / auto_denied / yolo / no_action / human prompt
 *   4. Persist approval record to data/approvals.json
 *   5. Return ApprovalResult
 *
 * This is the only public entry point for Phase 6.
 * Phase 7 (execution) calls this and checks result.approved before proceeding.
 */
export async function requestApproval(params: {
  plan: Plan;
  policyDecision: PolicyDecision;
  snapshot: WalletSnapshot;
  riskReport: RiskReport;
}): Promise<ApprovalResult> {
  const config = loadConfig();
  const { plan, policyDecision, snapshot, riskReport } = params;

  // ── 1. Determine routing ──────────────────────────────────────────────────
  const routing = determineRouting(
    config.approvalMode,
    policyDecision,
    plan,
    config.solanaNetwork
  );

  logger.debug(`Approval routing: ${routing} (mode=${config.approvalMode})`);

  // ── 2. Build request ──────────────────────────────────────────────────────
  const request = buildRequest({ plan, policyDecision, snapshot, riskReport, routing });

  // ── 3. Route ───────────────────────────────────────────────────────────────
  let decision: ApprovalDecision;

  switch (routing) {
    case "auto_approved": {
      decision = autoApproved(request.requestId);
      logger.success(formatApprovalOneLiner(true, decision.reason, decision.approvedBy));
      break;
    }

    case "auto_denied": {
      decision = autoDenied(request.requestId, policyDecision);
      logger.error(formatApprovalOneLiner(false, decision.reason, decision.approvedBy));
      break;
    }

    case "yolo": {
      decision = autoYolo(request.requestId);
      logger.warn(formatApprovalOneLiner(true, decision.reason, decision.approvedBy));
      break;
    }

    case "no_action_needed": {
      decision = autoNoAction(request.requestId, plan);
      logger.info(formatApprovalOneLiner(false, decision.reason, decision.approvedBy));
      break;
    }

    case "needs_human": {
      decision = await seekHumanApproval(request);
      const msg = formatApprovalOneLiner(decision.approved, decision.reason, decision.approvedBy);
      if (decision.approved) {
        logger.success(msg);
      } else {
        logger.warn(msg);
      }
      break;
    }

    default: {
      // Exhaustive check — should never reach here
      const _exhaustive: never = routing;
      throw new Error(`Unknown routing: ${String(_exhaustive)}`);
    }
  }

  // ── 4. Persist ─────────────────────────────────────────────────────────────
  appendApprovalRecord(request, decision);

  // ── 5. Return ─────────────────────────────────────────────────────────────
  return {
    request,
    decision,
    approved: decision.approved,
  };
}
