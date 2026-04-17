import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";

export const PendingReceiptSchema = z.object({
  runId: z.string(),
  planId: z.string(),
  approvalRequestId: z.string(),
  snapshotId: z.string(),

  actionTxSignature: z.string(),
  confirmedAt: z.string(),
  lamportsSpent: z.number().int().nonnegative(),

  savedAt: z.string(),
});

export type PendingReceipt = z.infer<typeof PendingReceiptSchema>;

function pendingPath(): string {
  const config = loadConfig();
  return path.join(config.dataDir, "pending-receipt.json");
}

export function savePendingReceipt(p: PendingReceipt): void {
  const validated = PendingReceiptSchema.parse(p);
  fs.writeFileSync(pendingPath(), JSON.stringify(validated, null, 2), "utf8");
  logger.debug(`Pending receipt saved: ${pendingPath()}`);
}

export function loadPendingReceipt(): PendingReceipt | null {
  const p = pendingPath();
  if (!fs.existsSync(p)) return null;

  try {
    const raw = fs.readFileSync(p, "utf8");
    return PendingReceiptSchema.parse(JSON.parse(raw));
  } catch (err) {
    logger.warn(`pending-receipt.json invalid (${String(err)}). Ignoring.`);
    return null;
  }
}

export function clearPendingReceipt(): void {
  const p = pendingPath();
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    logger.debug("Pending receipt cleared.");
  }
}
