/**
 * Developer utility — seeds a spend entry for testing daily cap logic.
 * Run with: npx ts-node src/utils/seedSpend.ts
 * NOT part of the production CLI.
 */
import { appendSpendEntry } from "../policy/spend-ledger.store";
import { nowIso } from "./time";

const entry = appendSpendEntry({
  timestamp: nowIso(),
  actionType: "swap",
  lamports: 50_000_000, // 0.05 SOL
  txSignature: "SEED_TX_SIG",
  note: "seeded by seedSpend.ts for testing",
});

console.log("Seeded spend entry:", entry);
