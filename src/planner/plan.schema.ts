import { z } from "zod";

// ── Action types ──────────────────────────────────────────────────────────

export const PlanActionTypeSchema = z.enum([
  "swap",
  "transfer",
  "none",
  "halt",
]);
export type PlanActionType = z.infer<typeof PlanActionTypeSchema>;

// ── Swap parameters ───────────────────────────────────────────────────────

export const PlanSwapParamsSchema = z.object({
  fromMint: z
    .string()
    .min(32)
    .describe("Base58 mint address of the token to sell"),
  toMint: z
    .string()
    .min(32)
    .describe("Base58 mint address of the token to buy"),
  inputAmountLamports: z
    .number()
    .int()
    .positive()
    .describe("Amount to sell in lamports (SOL-equivalent)"),
  slippageBps: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe("Slippage tolerance in basis points (e.g. 50 = 0.5%)"),
});
export type PlanSwapParams = z.infer<typeof PlanSwapParamsSchema>;

// ── Transfer parameters ───────────────────────────────────────────────────

export const PlanTransferParamsSchema = z.object({
  mint: z
    .string()
    .describe('Base58 mint address OR the string "SOL" for native SOL'),
  destinationAddress: z
    .string()
    .min(32)
    .describe("Base58 recipient wallet address"),
  amountLamports: z
    .number()
    .int()
    .positive()
    .describe("Amount to transfer in lamports"),
});
export type PlanTransferParams = z.infer<typeof PlanTransferParamsSchema>;

// ── Full plan schema ──────────────────────────────────────────────────────

export const PlanSchema = z.object({
  /**
   * Unique identifier for this plan.
   * Format: "plan-YYYYMMDD-HHmmss"
   * The LLM must generate this from its understanding of current time,
   * but we will override it server-side after validation.
   */
  planId: z
    .string()
    .describe("Unique plan identifier"),

  /**
   * Human-readable label for this plan.
   */
  label: z
    .string()
    .min(3)
    .max(80)
    .describe("Short label e.g. 'De-risk SOL exposure due to drawdown'"),

  /**
   * Why is this action recommended?
   * Plain English, 1-3 sentences.
   */
  reasoning: z
    .string()
    .min(10)
    .max(500)
    .describe("Why this action is recommended right now"),

  /**
   * What action type should be executed?
   * - swap: exchange one token for another via Jupiter
   * - transfer: send tokens/SOL to a destination address
   * - none: no action needed right now
   * - halt: stop the agent and require manual intervention
   */
  actionType: PlanActionTypeSchema,

  /**
   * Swap parameters — required if actionType is "swap".
   */
  swapParams: PlanSwapParamsSchema.nullable().optional(),

  /**
   * Transfer parameters — required if actionType is "transfer".
   */
  transferParams: PlanTransferParamsSchema.nullable().optional(),

  /**
   * Confidence score 0.0–1.0.
   * How confident is the planner in this recommendation?
   */
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in this plan (0.0 = uncertain, 1.0 = very confident)"),

  /**
   * Known risks of taking this action.
   * List of short strings.
   */
  risks: z
    .array(z.string().max(200))
    .max(5)
    .describe("Known risks of proceeding with this action"),

  /**
   * Tags for receipt indexing.
   * Short lowercase strings e.g. ["drawdown", "de-risk", "sol"].
   */
  receiptTags: z
    .array(z.string().max(32))
    .max(8)
    .describe("Short tags for receipt indexing"),

  /**
   * The trigger reason provided to the planner.
   * Echoed back so the receipt knows what caused the plan.
   */
  triggerReason: z
    .string()
    .describe("The trigger or reason that prompted this plan"),
});

export type Plan = z.infer<typeof PlanSchema>;

// ── Plan + policy decision bundle ─────────────────────────────────────────
// This is what gets passed to the approval engine in Phase 6.

import type { PolicyDecision } from "../policy/policy.engine.types";

export interface PlanBundle {
  plan: Plan;
  policyDecision: PolicyDecision;
  plannedAt: string;
}
