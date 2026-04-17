import { z } from "zod";

/**
 * A full wallet + market state snapshot taken at one point in time.
 * This is the primary input to the risk engine.
 */
export const WalletSnapshotSchema = z.object({
  snapshotId: z.string().describe("Unique ID for this snapshot (runId + timestamp)"),
  timestamp: z.string().describe("ISO UTC timestamp"),
  unixTs: z.number().int(),
  walletAddress: z.string(),

  // SOL balance
  solLamports: z.number().int().nonnegative(),
  solBalance: z.number().nonnegative(),

  // SPL token balances (non-zero only)
  splBalances: z.array(
    z.object({
      mint: z.string(),
      symbol: z.string().optional(),
      uiAmount: z.number().nonnegative().nullable(),
      uiAmountString: z.string(),
      decimals: z.number().int(),
    })
  ),

  // Prices (mint → USD)
  prices: z.record(z.string(), z.number().nonnegative()),

  // Optional rugcheck reports (mint → summary string)
  rugReports: z.record(z.string(), z.string()).optional(),

  // Total portfolio value estimate in USD (SOL value only in MVP)
  estimatedPortfolioUsd: z.number().nonnegative(),

  // Network
  network: z.string(),
});

export type WalletSnapshot = z.infer<typeof WalletSnapshotSchema>;
