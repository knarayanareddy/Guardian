import { z } from "zod";

// ── Execution summary (what happened on-chain) ─────────────────────────────

export const ReceiptExecutionSchema = z.object({
  actionType: z.enum(["swap", "transfer"]),
  actionTxSignature: z.string(),
  confirmedAt: z.string(),
  lamportsSpent: z.number().int().nonnegative(),

  explorerUrl: z.string().url(),
  solscanUrl: z.string().url(),
});

export type ReceiptExecution = z.infer<typeof ReceiptExecutionSchema>;

// ── Approval summary (who allowed it) ──────────────────────────────────────

export const ReceiptApprovalSchema = z.object({
  approvalRequestId: z.string(),
  approvedBy: z.string(),     // "human_cli" | "auto_policy" | "auto_yolo" etc.
  decidedAt: z.string(),
  reason: z.string(),
});

export type ReceiptApproval = z.infer<typeof ReceiptApprovalSchema>;

// ── Snapshot summaries (pre + post) ────────────────────────────────────────

export const ReceiptSnapshotSummarySchema = z.object({
  snapshotId: z.string(),
  timestamp: z.string(),
  solLamports: z.number().int().nonnegative(),
  solBalance: z.number().nonnegative(),
  estimatedPortfolioUsd: z.number().nonnegative(),
});

export type ReceiptSnapshotSummary = z.infer<typeof ReceiptSnapshotSummarySchema>;

// ── Plan summary (minimal but complete) ────────────────────────────────────

export const ReceiptPlanSummarySchema = z.object({
  planId: z.string(),
  label: z.string(),
  actionType: z.enum(["swap", "transfer", "none", "halt"]),
  confidence: z.number().min(0).max(1),
  triggerReason: z.string(),
  receiptTags: z.array(z.string()).default([]),

  // Keep params optional (depends on actionType)
  swapParams: z
    .object({
      fromMint: z.string(),
      toMint: z.string(),
      inputAmountLamports: z.number().int().positive(),
      slippageBps: z.number().int().min(1).max(1000),
    })
    .optional(),

  transferParams: z
    .object({
      mint: z.string(),
      destinationAddress: z.string(),
      amountLamports: z.number().int().positive(),
    })
    .optional(),
});

export type ReceiptPlanSummary = z.infer<typeof ReceiptPlanSummarySchema>;

// ── Receipt payload (this is what we hash) ─────────────────────────────────

export const ReceiptPayloadSchema = z.object({
  receiptVersion: z.literal(1),
  createdAt: z.string(),
  network: z.string(),

  agentWallet: z.string(),

  policyHash: z.string(),
  policyDecisionStatus: z.enum(["ALLOWED", "REQUIRES_APPROVAL", "DENIED"]),
  todaySpentLamportsAtPlan: z.number().int().nonnegative(),

  plan: ReceiptPlanSummarySchema,
  approval: ReceiptApprovalSchema,
  execution: ReceiptExecutionSchema,

  preSnapshot: ReceiptSnapshotSummarySchema,
  postSnapshot: ReceiptSnapshotSummarySchema.optional(),
});

export type ReceiptPayload = z.infer<typeof ReceiptPayloadSchema>;

// ── Anchor info (memo tx that anchors receiptHash) ─────────────────────────

export const ReceiptAnchorSchema = z.object({
  anchoredAt: z.string(),
  memo: z.string(),
  anchorTxSignature: z.string(),
  explorerUrl: z.string().url(),
  solscanUrl: z.string().url(),
});

export type ReceiptAnchor = z.infer<typeof ReceiptAnchorSchema>;

export const ReceiptWikiAnchorSchema = z.object({
  anchoredAt: z.string(),
  memo: z.string(),
  wikiAnchorTxSignature: z.string(),
  explorerUrl: z.string().url(),
  solscanUrl: z.string().url(),
});

export type ReceiptWikiAnchor = z.infer<typeof ReceiptWikiAnchorSchema>;

export const ReceiptWikiSchema = z.object({
  receiptWikiPath: z.string(),
  receiptWikiHash: z.string(),
  wikiAnchor: ReceiptWikiAnchorSchema.optional(),
});

export type ReceiptWiki = z.infer<typeof ReceiptWikiSchema>;

// ── Full receipt record (stored on disk) ───────────────────────────────────

export const ReceiptRecordSchema = z.object({
  receiptHash: z.string(), // sha256 hex of canonical payload
  payload: ReceiptPayloadSchema,
  anchor: ReceiptAnchorSchema.optional(),
  wiki: ReceiptWikiSchema.optional(),
});

export type ReceiptRecord = z.infer<typeof ReceiptRecordSchema>;
