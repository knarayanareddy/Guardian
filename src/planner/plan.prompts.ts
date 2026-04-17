import type { WalletSnapshot } from "../state/snapshot.schema";
import type { RiskReport } from "../risk/risk.types";
import type { Policy } from "../policy/policy.schema";
import { WSOL_MINT, USDC_MINT_DEVNET, USDC_MINT_MAINNET } from "../solana/addresses";
import { loadConfig } from "../config/loadConfig";

// ── Mint label helpers ─────────────────────────────────────────────────────

const KNOWN_MINTS: Record<string, string> = {
  [WSOL_MINT.toBase58()]: "SOL (wSOL)",
  [USDC_MINT_DEVNET.toBase58()]: "USDC (devnet)",
  [USDC_MINT_MAINNET.toBase58()]: "USDC (mainnet)",
};

function mintLabel(mint: string): string {
  return KNOWN_MINTS[mint] ?? mint;
}

// ── System prompt ──────────────────────────────────────────────────────────

export function buildSystemPrompt(): string {
  return `
You are Guardian, a policy-bound Solana wallet agent.
Your role is to analyze wallet state and market conditions, then produce a
single structured action plan in strict JSON format.

RULES YOU MUST FOLLOW:
1. Your output must be valid JSON that exactly matches the schema provided.
   Do not include any text before or after the JSON object.
2. You may only recommend one of these actionTypes: "swap", "transfer", "none", "halt".
3. You must include swapParams if actionType is "swap".
4. You must include transferParams if actionType is "transfer".
5. Never recommend amounts larger than allowed by policy constraints.
6. Never recommend destinations not in allowedDestinations (if the list is non-empty).
7. Never recommend mints in the denyMints list.
8. If no action is warranted, use actionType "none".
9. If conditions are dangerously uncertain, use actionType "halt".
10. Do NOT include private keys, seed phrases, or any secret material in your output.
11. Keep reasoning concise (1-3 sentences max).
12. The planId field should be "plan-auto" — it will be replaced server-side.

You are operating on: ${loadConfig().solanaNetwork.toUpperCase()}.
`.trim();
}

// ── Policy summary for prompt ──────────────────────────────────────────────

function buildPolicySummary(policy: Policy): string {
  const lines = [
    "CURRENT POLICY CONSTRAINTS:",
    `  Max single action : ${(policy.maxSingleActionLamports / 1e9).toFixed(4)} SOL (${policy.maxSingleActionLamports} lamports)`,
    `  Daily spend cap   : ${(policy.dailySpendCapLamports / 1e9).toFixed(4)} SOL`,
    `  Max slippage      : ${policy.maxSlippageBps} bps (${policy.maxSlippageBps / 100}%)`,
    `  Allowed actions   : ${policy.allowedActions.join(", ")}`,
  ];

  if (policy.allowedMints.length > 0) {
    lines.push(`  Allowed mints     : ${policy.allowedMints.map(mintLabel).join(", ")}`);
  } else {
    lines.push("  Allowed mints     : (all mints allowed)");
  }

  if (policy.denyMints.length > 0) {
    lines.push(`  DENY mints        : ${policy.denyMints.map(mintLabel).join(", ")}`);
  }

  if (policy.allowedDestinations.length > 0) {
    lines.push(`  Allowed dests     : ${policy.allowedDestinations.join(", ")}`);
  } else {
    lines.push("  Allowed dests     : (any destination allowed)");
  }

  lines.push(
    `  De-risk action    : ${policy.drawdownTrigger.deRiskAction}` +
    (policy.drawdownTrigger.safeWalletAddress
      ? ` → ${policy.drawdownTrigger.safeWalletAddress}`
      : "")
  );

  return lines.join("\n");
}

// ── Snapshot summary for prompt ────────────────────────────────────────────

function buildSnapshotSummary(snapshot: WalletSnapshot): string {
  const solMint = WSOL_MINT.toBase58();
  const solPrice = snapshot.prices[solMint] ?? 0;

  const lines = [
    "CURRENT WALLET STATE:",
    `  Wallet           : ${snapshot.walletAddress}`,
    `  SOL balance      : ${snapshot.solBalance.toFixed(6)} SOL (${snapshot.solLamports} lamports)`,
    `  SOL price (USD)  : $${solPrice.toFixed(4)}`,
    `  Portfolio est.   : $${snapshot.estimatedPortfolioUsd.toFixed(2)} USD`,
    `  Network          : ${snapshot.network}`,
    `  Snapshot time    : ${snapshot.timestamp}`,
  ];

  if (snapshot.splBalances.length > 0) {
    lines.push("  SPL Balances:");
    for (const s of snapshot.splBalances.slice(0, 8)) {
      const price = snapshot.prices[s.mint];
      const priceStr = price !== undefined ? ` ($${price.toFixed(4)}/unit)` : "";
      lines.push(`    ${mintLabel(s.mint)} : ${s.uiAmountString}${priceStr}`);
    }
  } else {
    lines.push("  SPL Balances     : (none)");
  }

  return lines.join("\n");
}

// ── Risk report summary for prompt ────────────────────────────────────────

function buildRiskSummary(report: RiskReport): string {
  const lines = [
    "CURRENT RISK STATUS:",
    `  Risk level       : ${report.riskLevel}`,
    `  Trigger count    : ${report.triggerCount}`,
    `  Recommended act  : ${report.recommendedAction}`,
  ];

  if (report.triggers.length > 0) {
    lines.push("  Active triggers:");
    for (const t of report.triggers) {
      switch (t.kind) {
        case "drawdown":
          lines.push(
            `    [DRAWDOWN] ${t.symbol ?? t.mint.slice(0, 8)} dropped ${t.dropPct.toFixed(2)}%` +
            ` over ${t.windowMinutes}min (threshold ${t.thresholdPct}%)` +
            ` $${t.windowStartPriceUsd.toFixed(4)} → $${t.currentPriceUsd.toFixed(4)}`
          );
          break;
        case "rug_risk":
          lines.push(
            `    [RUG RISK] ${t.mint.slice(0, 12)} score=${t.riskScore.toFixed(2)}`
          );
          break;
        case "low_sol":
          lines.push(`    [LOW SOL] ${t.currentLamports} lamports remaining`);
          break;
        case "execution_failure":
          lines.push(`    [EXEC FAILURE] ${t.failureCount} consecutive failures`);
          break;
      }
    }
  } else {
    lines.push("  No active triggers.");
  }

  return lines.join("\n");
}

// ── JSON schema description for prompt ────────────────────────────────────

function buildSchemaDescription(policy: Policy): string {
  // Provide well-known mint addresses to use for swap targets
  const solMint = WSOL_MINT.toBase58();
  const usdcMint =
    loadConfig().solanaNetwork === "devnet"
      ? USDC_MINT_DEVNET.toBase58()
      : USDC_MINT_MAINNET.toBase58();

  return `
REQUIRED OUTPUT FORMAT (strict JSON, no other text):
{
  "planId": "plan-auto",
  "label": "<short description of what this plan does>",
  "reasoning": "<1-3 sentences explaining why>",
  "actionType": "swap" | "transfer" | "none" | "halt",
  "swapParams": {                          // REQUIRED if actionType is "swap"
    "fromMint": "<base58 mint>",           // selling this token
    "toMint": "<base58 mint>",             // buying this token
    "inputAmountLamports": <integer>,      // amount to sell in lamports
    "slippageBps": <integer 1-1000>        // must be <= policy maxSlippageBps (${policy.maxSlippageBps})
  },
  "transferParams": {                      // REQUIRED if actionType is "transfer"
    "mint": "<base58 mint> or 'SOL'",
    "destinationAddress": "<base58 wallet>",
    "amountLamports": <integer>
  },
  "confidence": <0.0 to 1.0>,
  "risks": ["<risk 1>", "<risk 2>"],
  "receiptTags": ["<tag1>", "<tag2>"],
  "triggerReason": "<echoed trigger reason>"
}

KNOWN MINT ADDRESSES (use these for swaps):
  SOL/wSOL  : ${solMint}
  USDC      : ${usdcMint}

CONSTRAINTS REMINDER:
  - Max single action: ${policy.maxSingleActionLamports} lamports
  - Max slippage: ${policy.maxSlippageBps} bps
  - If no action needed: set actionType to "none", omit swapParams and transferParams
`.trim();
}

// ── Main user prompt builder ───────────────────────────────────────────────

export function buildUserPrompt(params: {
  snapshot: WalletSnapshot;
  riskReport: RiskReport;
  policy: Policy;
  triggerReason: string;
}): string {
  const { snapshot, riskReport, policy, triggerReason } = params;

  return [
    buildPolicySummary(policy),
    "",
    buildSnapshotSummary(snapshot),
    "",
    buildRiskSummary(riskReport),
    "",
    `TRIGGER REASON: ${triggerReason}`,
    "",
    buildSchemaDescription(policy),
    "",
    "Analyze the above and respond with a single JSON plan object.",
    "Your response must contain ONLY the JSON object — no markdown, no explanation, no code blocks.",
  ].join("\n");
}

// ── Retry correction prompt ────────────────────────────────────────────────

export function buildRetryPrompt(
  previousOutput: string,
  validationErrors: string[]
): string {
  return [
    "Your previous response was not valid. Errors found:",
    ...validationErrors.map((e) => `  - ${e}`),
    "",
    "Previous response was:",
    previousOutput.slice(0, 800),
    "",
    "Please respond again with ONLY a valid JSON object matching the schema.",
    "No markdown. No explanation. No code blocks. Just the JSON object.",
  ].join("\n");
}
