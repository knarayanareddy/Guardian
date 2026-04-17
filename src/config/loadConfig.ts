import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { z } from "zod";
import { logger } from "../utils/logger";

// Load .env before schema validation
dotenv.config();

// ─── Approval mode enum ────────────────────────────────────────
export const ApprovalModeSchema = z.enum(["always", "policyOnly", "never"]);
export type ApprovalMode = z.infer<typeof ApprovalModeSchema>;

// ─── Full config schema ────────────────────────────────────────
export const ConfigSchema = z.object({
  // Model provider
  openAiApiKey: z.string().min(10, "OPENAI_API_KEY is required"),

  // Solana
  solanaRpcUrl: z.string().url("SOLANA_RPC_URL must be a valid URL"),
  solanaNetwork: z.enum(["devnet", "mainnet-beta", "testnet"]).default("devnet"),

  // Agent wallet
  agentKeypairPath: z.string(),

  // Guardian runtime
  approvalMode: ApprovalModeSchema.default("always"),
  daemonIntervalSeconds: z.number().int().min(10).default(60),
  maxTxRetries: z.number().int().min(0).max(5).default(2),

  // Paths
  dataDir: z.string().default("./data"),
  wikiDir: z.string().default("./wiki"),
  receiptsDir: z.string().default("./data/receipts"),
});

export type Config = z.infer<typeof ConfigSchema>;

// ─── Loader ────────────────────────────────────────────────────
let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config !== null) return _config;

  const raw = {
    openAiApiKey: process.env.OPENAI_API_KEY ?? "",
    solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    solanaNetwork: process.env.SOLANA_NETWORK ?? "devnet",
    agentKeypairPath: process.env.AGENT_KEYPAIR_PATH ?? "./agent-keypair.json",
    approvalMode: process.env.APPROVAL_MODE ?? "always",
    daemonIntervalSeconds: Number(process.env.DAEMON_INTERVAL_SECONDS ?? "60"),
    maxTxRetries: Number(process.env.MAX_TX_RETRIES ?? "2"),
    dataDir: process.env.DATA_DIR ?? "./data",
    wikiDir: process.env.WIKI_DIR ?? "./wiki",
    receiptsDir: process.env.RECEIPTS_DIR ?? "./data/receipts",
  };

  const parsed = ConfigSchema.safeParse(raw);

  if (!parsed.success) {
    logger.error("Configuration validation failed:");
    for (const issue of parsed.error.issues) {
      logger.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  // Resolve paths to absolute
  const config = parsed.data;
  config.agentKeypairPath = path.resolve(config.agentKeypairPath);
  config.dataDir = path.resolve(config.dataDir);
  config.wikiDir = path.resolve(config.wikiDir);
  config.receiptsDir = path.resolve(config.receiptsDir);

  _config = config;
  return _config;
}

/**
 * Returns a safe version of the config for logging (no secrets).
 */
export function safeConfigSummary(config: Config): Record<string, unknown> {
  return {
    solanaRpcUrl: config.solanaRpcUrl,
    solanaNetwork: config.solanaNetwork,
    agentKeypairPath: config.agentKeypairPath,
    approvalMode: config.approvalMode,
    daemonIntervalSeconds: config.daemonIntervalSeconds,
    maxTxRetries: config.maxTxRetries,
    dataDir: config.dataDir,
    wikiDir: config.wikiDir,
    receiptsDir: config.receiptsDir,
    openAiApiKey: "[REDACTED]",
  };
}

/**
 * Verify that required directories exist (does not create them).
 */
export function checkDirsExist(config: Config): boolean {
  const dirs = [config.dataDir, config.wikiDir, config.receiptsDir];
  let allExist = true;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      logger.warn(`Directory does not exist: ${dir} (run guardian init)`);
      allExist = false;
    }
  }
  return allExist;
}
