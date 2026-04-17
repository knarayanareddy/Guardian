import { z } from "zod";

/**
 * A single price observation for one mint.
 */
export const PriceObservationSchema = z.object({
  timestamp: z.string().describe("ISO UTC timestamp"),
  unixTs: z.number().int().describe("Unix timestamp (seconds)"),
  mint: z.string().describe("Base58 mint address observed"),
  symbol: z.string().optional().describe("Human readable symbol e.g. SOL"),
  priceUsd: z.number().nonnegative().describe("Price in USD at observation time"),
  source: z.string().default("jupiter").describe("Price source identifier"),
});

export type PriceObservation = z.infer<typeof PriceObservationSchema>;

/**
 * The full price history file — one array of observations across all mints.
 * We cap this at MAX_OBSERVATIONS total entries to prevent unbounded growth.
 */
export const PriceHistorySchema = z.array(PriceObservationSchema);
export type PriceHistory = z.infer<typeof PriceHistorySchema>;

/**
 * Maximum number of observations to keep in the rolling buffer.
 * At 60s intervals, 2880 = ~48 hours of history.
 */
export const MAX_OBSERVATIONS = 2880;
