import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "../config/loadConfig";
import { ReceiptRecordSchema, type ReceiptRecord } from "./receipt.schema";
import { hashReceiptPayload } from "./receipt.hash";
import { logger } from "../utils/logger";

function receiptPathByHash(receiptHash: string): string {
  const config = loadConfig();
  return path.join(config.receiptsDir, `${receiptHash}.json`);
}

export function saveReceiptRecord(record: ReceiptRecord): string {
  const config = loadConfig();
  if (!fs.existsSync(config.receiptsDir)) fs.mkdirSync(config.receiptsDir, { recursive: true });

  // Validate schema
  const validated = ReceiptRecordSchema.parse(record);

  // Self-check the hash: must match payload
  const computed = hashReceiptPayload(validated.payload);
  if (computed !== validated.receiptHash) {
    throw new Error(
      `Receipt hash mismatch: record=${validated.receiptHash} computed=${computed}`
    );
  }

  const p = receiptPathByHash(validated.receiptHash);
  fs.writeFileSync(p, JSON.stringify(validated, null, 2), "utf8");
  logger.success(`Receipt saved: ${p}`);
  return p;
}

export function loadReceiptRecord(receiptHash: string): ReceiptRecord | null {
  const p = receiptPathByHash(receiptHash);
  if (!fs.existsSync(p)) return null;

  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    return ReceiptRecordSchema.parse(parsed);
  } catch (err) {
    logger.warn(`Failed to load receipt: ${p} (${String(err)})`);
    return null;
  }
}

export function verifyReceiptRecordHash(receiptHash: string): { ok: boolean; computed?: string; error?: string } {
  const rec = loadReceiptRecord(receiptHash);
  if (!rec) return { ok: false, error: "Receipt not found" };

  const computed = hashReceiptPayload(rec.payload);
  if (computed !== rec.receiptHash) {
    return { ok: false, computed, error: "Hash mismatch" };
  }
  return { ok: true, computed };
}

export function listReceipts(n = 20): string[] {
  const config = loadConfig();
  if (!fs.existsSync(config.receiptsDir)) return [];

  return fs
    .readdirSync(config.receiptsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort()
    .reverse()
    .slice(0, n);
}
