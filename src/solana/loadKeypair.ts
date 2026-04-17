import * as fs from "fs";
import { Keypair } from "@solana/web3.js";

export function loadKeypairFromFile(filePath: string): Keypair {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Keypair file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Keypair file is not valid JSON: ${filePath}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Keypair JSON must be an array of numbers: ${filePath}`);
  }

  const nums = parsed;
  if (nums.length < 32) {
    throw new Error(`Keypair array too short (${nums.length}). Expected 64-ish bytes.`);
  }

  const secretKey = Uint8Array.from(nums.map((n) => {
    if (typeof n !== "number" || !Number.isFinite(n)) throw new Error("Invalid keypair byte");
    return n;
  }));

  return Keypair.fromSecretKey(secretKey);
}
