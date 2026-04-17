import { z } from "zod";

// ─── Solana mint address ────────────────────────────────────────
const MintAddressSchema = z
  .string()
  .length(44)
  .or(z.string().length(43))
  .describe("A base58 Solana mint address");

// ─── "Require approval if" nested object ───────────────────────
export const RequireApprovalIfSchema = z.object({
  overLamports: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Require approval if action involves more than N lamports"),
  newMint: z
    .boolean()
    .optional()
    .describe("Require approval if the token mint is not in allowedMints"),
  riskScoreAbove: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Require approval if rugcheck risk score exceeds this (0-1)"),
});

export type RequireApprovalIf = z.infer<typeof RequireApprovalIfSchema>;

// ─── Drawdown trigger config ────────────────────────────────────
export const DrawdownTriggerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  windowMinutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .default(30)
    .describe("Time window to measure drawdown over (minutes)"),
  thresholdPct: z
    .number()
    .min(0.1)
    .max(99)
    .default(7)
    .describe("Trigger if price drops by this percentage in the window"),
  deRiskAction: z
    .enum(["swap_to_usdc", "transfer_to_safe", "none"])
    .default("swap_to_usdc"),
  safeWalletAddress: z
    .string()
    .optional()
    .describe("Required if deRiskAction is transfer_to_safe"),
});

export type DrawdownTriggerConfig = z.infer<typeof DrawdownTriggerConfigSchema>;

// ─── Full policy schema ────────────────────────────────────────
export const PolicySchema = z.object({
  version: z.literal(1).default(1),

  // Mints
  allowedMints: z
    .array(MintAddressSchema)
    .default([])
    .describe("Whitelist of mint addresses the agent can interact with. Empty = all allowed."),
  denyMints: z
    .array(MintAddressSchema)
    .default([])
    .describe("Blacklist of mint addresses. Takes priority over allowedMints."),

  // Spend limits
  maxSingleActionLamports: z
    .number()
    .int()
    .positive()
    .default(200_000_000)
    .describe("Max lamports (SOL equivalent) per single action. Default: 0.2 SOL"),
  dailySpendCapLamports: z
    .number()
    .int()
    .positive()
    .default(500_000_000)
    .describe("Max lamports spent per calendar day. Default: 0.5 SOL"),

  // Swap parameters
  maxSlippageBps: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(50)
    .describe("Max slippage in basis points. Default: 50 (0.5%)"),

  // Transfer parameters
  allowedDestinations: z
    .array(z.string())
    .default([])
    .describe("Whitelist of allowed destination wallet addresses for transfers. Empty = any."),

  // Allowed action types
  allowedActions: z
    .array(z.enum(["swap", "transfer"]))
    .default(["swap", "transfer"]),

  // Triggers
  drawdownTrigger: DrawdownTriggerConfigSchema.default({}),

  // Approval thresholds
  requireApprovalIf: RequireApprovalIfSchema.default({
    overLamports: 100_000_000,
    newMint: true,
    riskScoreAbove: 0.7,
  }),
});

export type Policy = z.infer<typeof PolicySchema>;
