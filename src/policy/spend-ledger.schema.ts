import { z } from "zod";

/**
 * A single spend entry — one per executed action.
 * Written by the execution subsystem (Phase 7),
 * read by the policy engine (this phase).
 */
export const SpendEntrySchema = z.object({
  timestamp: z.string().describe("ISO UTC timestamp of the action"),
  utcDate: z.string().describe("YYYY-MM-DD UTC date (for day-bucketing)"),
  actionType: z.enum(["swap", "transfer"]),
  lamports: z.number().int().nonnegative(),
  txSignature: z.string().optional(),
  receiptHash: z.string().optional(),
  note: z.string().optional(),
});

export type SpendEntry = z.infer<typeof SpendEntrySchema>;

/**
 * The full ledger file — an array of entries.
 */
export const SpendLedgerSchema = z.array(SpendEntrySchema);
export type SpendLedger = z.infer<typeof SpendLedgerSchema>;
