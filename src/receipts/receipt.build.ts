import type { SolanaContext } from "../solana/makeAgent";
import type { PolicyDecision } from "../policy/policy.engine.types";
import type { Plan } from "../planner/plan.schema";
import type { ExecutionSuccess } from "../execute/execute.types";
import { ReceiptPayloadSchema, type ReceiptPayload, type ReceiptRecord } from "./receipt.schema";
import { hashReceiptPayload } from "./receipt.hash";
import { loadConfig } from "../config/loadConfig";
import { nowIso } from "../utils/time";
import { takeSnapshot } from "../state/snapshot";
import { logger } from "../utils/logger";
import { loadApprovals } from "../approvals/approval.store";

function snapshotSummary(s: {
  snapshotId: string;
  timestamp: string;
  solLamports: number;
  solBalance: number;
  estimatedPortfolioUsd: number;
}) {
  return {
    snapshotId: s.snapshotId,
    timestamp: s.timestamp,
    solLamports: s.solLamports,
    solBalance: s.solBalance,
    estimatedPortfolioUsd: s.estimatedPortfolioUsd,
  };
}

export async function buildReceiptRecord(params: {
  ctx: SolanaContext;

  plan: Plan;
  policyDecision: PolicyDecision;
  execution: ExecutionSuccess;

  approvalRequestId: string;
  preSnapshotId: string;

  // We pass the pre-snapshot fields (we already have full snapshot object in run.ts)
  preSnapshot: {
    snapshotId: string;
    timestamp: string;
    solLamports: number;
    solBalance: number;
    estimatedPortfolioUsd: number;
  };
}): Promise<ReceiptRecord> {
  const config = loadConfig();

  // ── Load approval record to capture "approvedBy", decidedAt, reason ───────
  const approvals = loadApprovals();
  const rec = approvals.find((r) => r.request.requestId === params.approvalRequestId);

  if (!rec) {
    throw new Error(`Approval record not found for requestId: ${params.approvalRequestId}`);
  }
  const approval = rec.decision;

  // ── Post-execution snapshot (best effort; do not fail receipt if snapshot fails) ──
  let postSnapshotSummary: ReceiptPayload["postSnapshot"] | undefined;

  try {
    const post = await takeSnapshot(params.ctx);
    postSnapshotSummary = snapshotSummary({
      snapshotId: post.snapshotId,
      timestamp: post.timestamp,
      solLamports: post.solLamports,
      solBalance: post.solBalance,
      estimatedPortfolioUsd: post.estimatedPortfolioUsd,
    });
  } catch (err) {
    logger.warn(`Post-execution snapshot failed (non-fatal): ${String(err)}`);
  }

  // ── Build payload (this is what we hash) ─────────────────────────────────
  const payload: ReceiptPayload = ReceiptPayloadSchema.parse({
    receiptVersion: 1,
    createdAt: nowIso(),
    network: config.solanaNetwork,

    agentWallet: params.ctx.walletAddress,

    policyHash: params.policyDecision.policyHash,
    policyDecisionStatus: params.policyDecision.status,
    todaySpentLamportsAtPlan: params.policyDecision.todaySpentLamports,

    plan: {
      planId: params.plan.planId,
      label: params.plan.label,
      actionType: params.plan.actionType,
      confidence: params.plan.confidence,
      triggerReason: params.plan.triggerReason,
      receiptTags: params.plan.receiptTags ?? [],
      swapParams: params.plan.swapParams,
      transferParams: params.plan.transferParams,
    },

    approval: {
      approvalRequestId: params.approvalRequestId,
      approvedBy: approval.approvedBy,
      decidedAt: approval.decidedAt,
      reason: approval.reason,
    },

    execution: {
      actionType: params.execution.isSimulation ? "swap" : (params.plan.actionType as "swap" | "transfer"),
      actionTxSignature: params.execution.txSignature,
      confirmedAt: params.execution.confirmedAt,
      lamportsSpent: params.execution.lamportsSpent,
      explorerUrl: params.execution.explorerUrl,
      solscanUrl: params.execution.solscanUrl,
    },

    preSnapshot: snapshotSummary(params.preSnapshot),

    postSnapshot: postSnapshotSummary,
  });

  const receiptHash = hashReceiptPayload(payload);

  const record: ReceiptRecord = {
    receiptHash,
    payload,
  };

  logger.success(`Receipt payload built. hash=${receiptHash}`);
  return record;
}
