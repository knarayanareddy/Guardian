import { PublicKey } from "@solana/web3.js";

/**
 * Standard SPL Token Program ID (Tokenkeg...)
 * (We define it directly to avoid adding @solana/spl-token in MVP.)
 */
export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

/**
 * Wrapped SOL mint (wSOL). Commonly used as "SOL mint" in token contexts.
 */
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

/**
 * USDC mint addresses.
 * Devnet USDC mint is widely referenced as 4zMMC9...ncDU.
 * Mainnet USDC mint is EPjFWd... (canonical).
 */
export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

export const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

export function isBase58Pubkey(s: string): boolean {
  // Very light check (length-based) — full validation happens when PublicKey ctor runs.
  return s.length >= 32 && s.length <= 44;
}
