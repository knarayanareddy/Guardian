import { checkSwap, checkTransfer } from "../policy/policy.engine";
import { formatPolicyDecision } from "../policy/policy.decision.format";
import { WSOL_MINT, USDC_MINT_DEVNET } from "../solana/addresses";
import { logger } from "../utils/logger";

/**
 * A built-in set of test scenarios the user can validate against.
 */
interface TestScenario {
  id: string;
  description: string;
  type: "swap" | "transfer";
  params: any;
}

const SCENARIOS: TestScenario[] = [
  {
    id: "small-swap",
    description: "Small SOL→USDC swap (0.05 SOL, 0.5% slippage)",
    type: "swap",
    params: {
      fromMint: WSOL_MINT.toBase58(),
      toMint: USDC_MINT_DEVNET.toBase58(),
      inputAmountLamports: 50_000_000,
      slippageBps: 50,
    },
  },
  {
    id: "large-swap",
    description: "Large SOL→USDC swap (0.3 SOL — likely over single-action cap)",
    type: "swap",
    params: {
      fromMint: WSOL_MINT.toBase58(),
      toMint: USDC_MINT_DEVNET.toBase58(),
      inputAmountLamports: 300_000_000,
      slippageBps: 50,
    },
  },
  {
    id: "high-slippage",
    description: "Swap with 5% slippage (likely violates maxSlippageBps)",
    type: "swap",
    params: {
      fromMint: WSOL_MINT.toBase58(),
      toMint: USDC_MINT_DEVNET.toBase58(),
      inputAmountLamports: 50_000_000,
      slippageBps: 500,
    },
  },
  {
    id: "approval-threshold",
    description: "Swap just over approval threshold (0.15 SOL — REQUIRES APPROVAL)",
    type: "swap",
    params: {
      fromMint: WSOL_MINT.toBase58(),
      toMint: USDC_MINT_DEVNET.toBase58(),
      inputAmountLamports: 150_000_000,
      slippageBps: 50,
    },
  },
  {
    id: "high-risk",
    description: "Swap with high risk score (0.9 — triggers risk approval threshold)",
    type: "swap",
    params: {
      fromMint: WSOL_MINT.toBase58(),
      toMint: USDC_MINT_DEVNET.toBase58(),
      inputAmountLamports: 50_000_000,
      slippageBps: 50,
      estimatedRiskScore: 0.9,
    },
  },
  {
    id: "small-transfer-safe",
    description: "Small SOL transfer (0.05 SOL to arbitrary address)",
    type: "transfer",
    params: {
      mint: "SOL",
      destinationAddress: "3EfZ5PoxTwSpzsBj5dXauLHf8yd7gkBc8Bvs3EJmhHoK",
      amountLamports: 50_000_000,
    },
  },
  {
    id: "denied-transfer-nodest",
    description: "Transfer to address NOT in allowedDestinations (if list is non-empty)",
    type: "transfer",
    params: {
      mint: "SOL",
      destinationAddress: "UNKNOWN_DEST_99999999999999999999999999999",
      amountLamports: 50_000_000,
    },
  },
];

export async function runPolicyValidate(opts: {
  scenario?: string;
  all?: boolean;
}): Promise<void> {
  logger.section("Policy Validate");

  let scenariosToRun: TestScenario[] = [];

  if (opts.all) {
    scenariosToRun = SCENARIOS;
  } else if (opts.scenario) {
    const found = SCENARIOS.find((s) => s.id === opts.scenario);
    if (!found) {
      logger.error(`Unknown scenario: ${opts.scenario}`);
      logger.raw(`Available scenarios:\n${SCENARIOS.map((s) => `  ${s.id}`).join("\n")}`);
      process.exit(1);
    }
    scenariosToRun = [found];
  } else {
    logger.raw("Available scenarios:");
    for (const s of SCENARIOS) {
      logger.raw(`  ${s.id.padEnd(24)} ${s.description}`);
    }
    logger.blank();
    logger.raw("Usage:");
    logger.raw("  guardian policy validate --scenario small-swap");
    logger.raw("  guardian policy validate --all");
    return;
  }

  for (const sc of scenariosToRun) {
    logger.blank();
    logger.raw(`─── Scenario: ${sc.id} ───`);
    logger.raw(`    ${sc.description}`);
    logger.blank();

    const decision = sc.type === "swap" ? checkSwap(sc.params) : checkTransfer(sc.params);
    logger.raw(formatPolicyDecision(decision));
    logger.blank();
  }
}
