import type { SolanaContext } from "../solana/makeAgent";
import { getSolBalance, getSplTokenBalances } from "./balances";
import { appendPriceObservation } from "./price-history.store";
import {
  WalletSnapshotSchema,
  type WalletSnapshot,
} from "./snapshot.schema";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";
import { nowIso, nowUnix, makeRunId } from "../utils/time";
import { WSOL_MINT } from "../solana/addresses";

// ── Price fetcher ──────────────────────────────────────────────────────────

/**
 * Fetch the USD price of a mint using the Agent Kit.
 * Returns 0 if price fetch fails (non-fatal).
 *
 * Solana Agent Kit Token Plugin includes fetchPrice as a tool
 * that queries Jupiter price API internally. 
 */
async function fetchMintPriceUsd(
  ctx: SolanaContext,
  mint: string
): Promise<number> {
  try {
    // SolanaAgentKit methods.fetchPrice returns price as string or number
    const raw = await (ctx.agent as any).methods.fetchPrice(mint);
    const n = typeof raw === "string" ? parseFloat(raw) : Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  } catch (err) {
    logger.warn(`fetchPrice failed for ${mint}: ${String(err)}`);
    return 0;
  }
}

// ── Portfolio value estimate ───────────────────────────────────────────────

/**
 * Compute a simple USD portfolio estimate.
 * MVP: SOL balance × SOL price only (SPL values require per-mint price calls).
 */
function estimatePortfolioUsd(
  solBalance: number,
  prices: Record<string, number>
): number {
  const solPrice = prices[WSOL_MINT.toBase58()] ?? 0;
  return solBalance * solPrice;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Take a full state snapshot.
 * Fetches balances, prices, and optional rug reports.
 * Appends price observations to price-history store.
 */
export async function takeSnapshot(ctx: SolanaContext): Promise<WalletSnapshot> {
  const config = loadConfig();
  const ts = nowIso();
  const unix = nowUnix();
  const snapshotId = `snap-${makeRunId()}`;

  logger.debug(`Taking snapshot: ${snapshotId}`);

  // ── Balances ─────────────────────────────────────────────────────────────
  const solBal = await getSolBalance(ctx.connection, ctx.keypair.publicKey);
  const splBals = await getSplTokenBalances(ctx.connection, ctx.keypair.publicKey);

  // ── Prices ───────────────────────────────────────────────────────────────
  const prices: Record<string, number> = {};

  // Always fetch SOL price
  const solMint = WSOL_MINT.toBase58();
  const solPrice = await fetchMintPriceUsd(ctx, solMint);
  prices[solMint] = solPrice;

  // Record SOL price observation
  appendPriceObservation({
    timestamp: ts,
    unixTs: unix,
    mint: solMint,
    symbol: "SOL",
    priceUsd: solPrice,
    source: "jupiter",
  });

  // Fetch prices for non-zero SPL balances (best-effort)
  for (const spl of splBals.slice(0, 10)) {
    if (!(spl.mint in prices)) {
      const p = await fetchMintPriceUsd(ctx, spl.mint);
      prices[spl.mint] = p;

      if (p > 0) {
        appendPriceObservation({
          timestamp: ts,
          unixTs: unix,
          mint: spl.mint,
          priceUsd: p,
          source: "jupiter",
        });
      }
    }
  }

  // ── Portfolio estimate ────────────────────────────────────────────────────
  const estimatedPortfolioUsd = estimatePortfolioUsd(solBal.sol, prices);

  // ── Assemble snapshot ─────────────────────────────────────────────────────
  const raw: WalletSnapshot = {
    snapshotId,
    timestamp: ts,
    unixTs: unix,
    walletAddress: ctx.walletAddress,
    solLamports: solBal.lamports,
    solBalance: solBal.sol,
    splBalances: splBals.map((s) => ({
      mint: s.mint,
      uiAmount: s.uiAmount,
      uiAmountString: s.uiAmountString,
      decimals: s.decimals,
    })),
    prices,
    estimatedPortfolioUsd,
    network: config.solanaNetwork,
  };

  return WalletSnapshotSchema.parse(raw);
}

/**
 * Human-readable snapshot summary for CLI display.
 */
export function formatSnapshotSummary(snap: WalletSnapshot): string {
  const solPrice = snap.prices[WSOL_MINT.toBase58()] ?? 0;
  const lines = [
    `Snapshot ID    : ${snap.snapshotId}`,
    `Timestamp      : ${snap.timestamp}`,
    `Wallet         : ${snap.walletAddress}`,
    `Network        : ${snap.network}`,
    ``,
    `SOL balance    : ${snap.solBalance.toFixed(6)} SOL`,
    `SOL price      : $${solPrice.toFixed(2)}`,
    `Portfolio est. : $${snap.estimatedPortfolioUsd.toFixed(2)} USD`,
    ``,
  ];

  if (snap.splBalances.length > 0) {
    lines.push("SPL Balances (non-zero):");
    for (const s of snap.splBalances.slice(0, 10)) {
      const price = snap.prices[s.mint];
      const priceStr = price !== undefined ? ` @ $${price.toFixed(4)}` : "";
      lines.push(`  ${s.mint.slice(0, 12)}...  ${s.uiAmountString}${priceStr}`);
    }
    if (snap.splBalances.length > 10) {
      lines.push(`  ...and ${snap.splBalances.length - 10} more`);
    }
    lines.push("");
  } else {
    lines.push("SPL Balances   : (none / all zero)");
    lines.push("");
  }

  return lines.join("\n");
}
