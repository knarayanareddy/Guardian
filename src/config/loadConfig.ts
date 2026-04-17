import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { z } from "zod";
import { logger } from "../utils/logger";

dotenv.config();

export const ApprovalModeSchema = z.enum(["always", "policyOnly", "never"]);
export type ApprovalMode = z.infer<typeof ApprovalModeSchema>;

export const ConfigSchema = z.object({
  // Model provider (OpenAI-compatible)
  llmApiKey: z.string().optional().default(""),
  llmBaseUrl: z.string().url().default("http://localhost:11434/v1"),
  llmModel: z.string().min(1).default("qwen2.5:7b-instruct"),

  // Backward-compat fallback
  openAiApiKey: z.string().optional().default(""),

  // Solana
  solanaRpcUrl: z.string().url("SOLANA_RPC_URL must be a valid URL"),
  solanaNetwork: z.enum(["devnet", "mainnet-beta", "testnet"]).default("devnet"),

  // Agent wallet
  agentKeypairPath: z.string(),

  // Guardian runtime
  approvalMode: ApprovalModeSchema.default("always"),
  daemonIntervalSeconds: z.number().int().min(10).default(60),
  maxTxRetries: z.number().int().min(0).max(5).default(2),

  dataDir: z.string().default("./data"),
  wikiDir: z.string().default("./wiki"),
  receiptsDir: z.string().default("./data/receipts"),
  cacheDir: z.string().default("./data/cache"),

  // Web search (SearXNG)
  searxngEnabled: z.boolean().default(false),
  searxngBaseUrl: z.string().url().optional().default(""),
  searxngNumResults: z.number().int().min(1).max(10).default(5),
  searxngLanguage: z.string().default("en"),
  searxngSafesearch: z.number().int().min(0).max(2).default(1),

  // Web browsing (fetch + extract + cache)
  browseEnabled: z.boolean().default(false),
  browseMaxPages: z.number().int().min(0).max(5).default(2),
  browseMaxCharsPerPage: z.number().int().min(200).max(8000).default(1600),
  browseCacheTtlSeconds: z.number().int().min(0).max(604800).default(86400),
  browseTimeoutMs: z.number().int().min(1000).max(30000).default(12000),
  browseUserAgent: z.string().default("GuardianBot/0.10 (devnet)"),

  // Browse summarization (LLM)
  browseSummaryEnabled: z.boolean().default(false),
  browseSummaryModel: z.string().optional().default(""),
  browseSummaryMaxInputChars: z.number().int().min(500).max(20000).default(4000),
  browseSummaryMaxTokens: z.number().int().min(64).max(1000).default(220),
  browseSummaryTemperature: z.number().min(0).max(1).default(0.2),

  failureHaltThreshold: z.number().int().min(1).max(50).default(3),
  daemonBackoffMaxSeconds: z.number().int().min(0).max(3600).default(300),
  wikiHashAnchorEnabled: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config !== null) return _config;

  const raw = {
    llmApiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
    llmBaseUrl: process.env.LLM_BASE_URL ?? "http://localhost:11434/v1",
    llmModel: process.env.LLM_MODEL ?? "qwen2.5:7b-instruct",
    openAiApiKey: process.env.OPENAI_API_KEY ?? "",

    solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    solanaNetwork: (process.env.SOLANA_NETWORK as any) ?? "devnet",
    agentKeypairPath: process.env.AGENT_KEYPAIR_PATH ?? "./agent-keypair.json",
    approvalMode: process.env.APPROVAL_MODE ?? "always",
    daemonIntervalSeconds: Number(process.env.DAEMON_INTERVAL_SECONDS ?? "60"),
    maxTxRetries: Number(process.env.MAX_TX_RETRIES ?? "2"),
    dataDir: process.env.DATA_DIR ?? "./data",
    wikiDir: process.env.WIKI_DIR ?? "./wiki",
    receiptsDir: process.env.RECEIPTS_DIR ?? "./data/receipts",
    cacheDir: process.env.CACHE_DIR ?? "./data/cache",

    searxngEnabled: (process.env.SEARXNG_ENABLED ?? "false").toLowerCase() === "true",
    searxngBaseUrl: process.env.SEARXNG_BASE_URL ?? "",
    searxngNumResults: Number(process.env.SEARXNG_NUM_RESULTS ?? "5"),
    searxngLanguage: process.env.SEARXNG_LANGUAGE ?? "en",
    searxngSafesearch: Number(process.env.SEARXNG_SAFESEARCH ?? "1"),

    browseEnabled: (process.env.BROWSE_ENABLED ?? "false").toLowerCase() === "true",
    browseMaxPages: Number(process.env.BROWSE_MAX_PAGES ?? "2"),
    browseMaxCharsPerPage: Number(process.env.BROWSE_MAX_CHARS_PER_PAGE ?? "1600"),
    browseCacheTtlSeconds: Number(process.env.BROWSE_CACHE_TTL_SECONDS ?? "86400"),
    browseTimeoutMs: Number(process.env.BROWSE_TIMEOUT_MS ?? "12000"),
    browseUserAgent: process.env.BROWSE_USER_AGENT ?? "GuardianBot/0.10 (devnet)",

    browseSummaryEnabled: (process.env.BROWSE_SUMMARY_ENABLED ?? "false").toLowerCase() === "true",
    browseSummaryModel: process.env.BROWSE_SUMMARY_MODEL ?? "",
    browseSummaryMaxInputChars: Number(process.env.BROWSE_SUMMARY_MAX_INPUT_CHARS ?? "4000"),
    browseSummaryMaxTokens: Number(process.env.BROWSE_SUMMARY_MAX_TOKENS ?? "220"),
    browseSummaryTemperature: Number(process.env.BROWSE_SUMMARY_TEMPERATURE ?? "0.2"),

    failureHaltThreshold: Number(process.env.FAILURE_HALT_THRESHOLD ?? "3"),
    daemonBackoffMaxSeconds: Number(process.env.DAEMON_BACKOFF_MAX_SECONDS ?? "300"),
    wikiHashAnchorEnabled: (process.env.WIKI_HASH_ANCHOR_ENABLED ?? "false").toLowerCase() === "true",
  };

  const parsed = ConfigSchema.safeParse(raw);

  if (!parsed.success) {
    logger.error("Configuration validation failed:");
    for (const issue of parsed.error.issues) {
      logger.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  const config = parsed.data;

  config.agentKeypairPath = path.resolve(config.agentKeypairPath);
  config.dataDir = path.resolve(config.dataDir);
  config.wikiDir = path.resolve(config.wikiDir);
  config.receiptsDir = path.resolve(config.receiptsDir);
  config.cacheDir = path.resolve(config.cacheDir);

  _config = config;

  if (!config.llmApiKey && !config.llmBaseUrl.includes("localhost") && !config.llmBaseUrl.includes("127.0.0.1")) {
    logger.warn("LLM_API_KEY is not set. (OK for local Ollama; required for cloud tools.)");
  }

  return _config;
}

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
    failureHaltThreshold: config.failureHaltThreshold,
    daemonBackoffMaxSeconds: config.daemonBackoffMaxSeconds,
    wikiHashAnchorEnabled: config.wikiHashAnchorEnabled,
    llmBaseUrl: config.llmBaseUrl,
    llmModel: config.llmModel,
    llmApiKey: config.llmApiKey ? "[REDACTED]" : "(missing)",
    searxngEnabled: config.searxngEnabled,
    browseEnabled: config.browseEnabled,
    browseSummaryEnabled: config.browseSummaryEnabled,
    cacheDir: config.cacheDir,
  };
}


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
