import { canonicalJson } from "../utils/jsonStable";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Sha256 = require("sha.js/sha256");

export function sha256Hex(input: string): string {
  return new Sha256().update(input, "utf8").digest("hex") as string;
}

/**
 * Hash payload deterministically.
 * Hash is computed over canonical JSON string (stable key ordering).
 */
export function hashReceiptPayload(payload: unknown): string {
  const canon = canonicalJson(payload);
  return sha256Hex(canon);
}
