import { z } from "zod";

export const DaemonStateSchema = z.object({
  version: z.literal(1).default(1),

  // failure tracking
  consecutiveFailures: z.number().int().min(0).default(0),
  lastFailureAt: z.string().optional(),
  lastFailureReason: z.string().optional(),

  lastSuccessAt: z.string().optional(),
  lastReceiptHash: z.string().optional(),
  lastActionTx: z.string().optional(),

  // backoff
  backoffSeconds: z.number().int().min(0).default(0),
});

export type DaemonState = z.infer<typeof DaemonStateSchema>;
