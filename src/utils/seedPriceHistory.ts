/**
 * Developer utility — seeds price history entries for testing drawdown detection.
 *
 * Creates a series of observations where SOL price starts high and drops,
 * so the drawdown trigger fires reliably in test runs.
 *
 * Run with: npx ts-node src/utils/seedPriceHistory.ts
 * NOT part of the production CLI.
 */
import { appendPriceObservation } from "../state/price-history.store";
import { WSOL_MINT } from "../solana/addresses";
import { nowUnix } from "./time";

const MINT = WSOL_MINT.toBase58();
const NOW = nowUnix();

/**
 * Seed 10 observations simulating a 10% price drop over 30 minutes.
 * This will reliably trigger the default drawdown threshold of 7%.
 */
const observations = [
  // 35 minutes ago — window start (high price)
  { minutesAgo: 35, priceUsd: 150.00 },
  { minutesAgo: 33, priceUsd: 149.50 },
  { minutesAgo: 30, priceUsd: 148.00 },
  { minutesAgo: 27, priceUsd: 146.00 },
  { minutesAgo: 24, priceUsd: 144.00 },
  { minutesAgo: 20, priceUsd: 142.00 },
  { minutesAgo: 15, priceUsd: 140.00 },
  { minutesAgo: 10, priceUsd: 138.00 },
  { minutesAgo:  5, priceUsd: 136.00 },
  // Most recent — 10% below window start
  { minutesAgo:  1, priceUsd: 135.00 },
];

console.log("Seeding price history...");
for (const o of observations) {
  const ts = new Date((NOW - o.minutesAgo * 60) * 1000).toISOString();
  appendPriceObservation({
    timestamp: ts,
    unixTs: NOW - o.minutesAgo * 60,
    mint: MINT,
    symbol: "SOL",
    priceUsd: o.priceUsd,
    source: "seed",
  });
  console.log(`  seeded: t-${o.minutesAgo}min  $${o.priceUsd}`);
}

console.log("\nDone. Run: npx ts-node src/index.ts risk status");
console.log("(Note: live price will be fetched from Jupiter. If live price > seeded,");
console.log(" no drawdown will trigger. Edit observations above to test with lower prices.)");
