// eslint-disable-next-line @typescript-eslint/no-require-imports
const Sha256 = require("sha.js/sha256");

/**
 * SHA-256 hex of a UTF-8 string.
 */
export function sha256HexUtf8(input: string): string {
  return new Sha256().update(input, "utf8").digest("hex") as string;
}

/**
 * Hash markdown content (raw bytes).
 * This is not canonicalized on purpose: the hash represents the exact content.
 */
export function hashMarkdown(md: string): string {
  return sha256HexUtf8(md);
}
