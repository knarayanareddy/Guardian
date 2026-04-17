import * as fs from "fs";
import * as path from "path";
import { loadConfig, safeConfigSummary } from "../config/loadConfig";
import { savePolicy } from "../policy/policy.store";
import { PolicySchema } from "../policy/policy.schema";
import { logger } from "../utils/logger";
import { nowIso } from "../utils/time";

const DEFAULT_WIKI_INDEX = `# Guardian Wiki

Auto-generated audit log for the Guardian agent.

## Structure
- \`policies/\` — policy snapshots
- \`runs/\` — per-run summaries
- \`receipts/\` — per-action receipt narratives

## Quick links
- [Current policy](policies/current.md)

---
*Initialized at ${nowIso()}*
`;

export async function runInit(): Promise<void> {
  logger.section("Guardian Init");

  const config = loadConfig();
  logger.info("Config loaded:", safeConfigSummary(config));

  // ── Create data directories ──────────────────────────────────
  const dirs = [
    config.dataDir,
    config.receiptsDir,
    path.join(config.dataDir, "runs"),
    config.wikiDir,
    path.join(config.wikiDir, "policies"),
    path.join(config.wikiDir, "runs"),
    path.join(config.wikiDir, "receipts"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.success(`Created: ${dir}`);
    } else {
      logger.debug(`Exists: ${dir}`);
    }
  }

  // ── Create default policy if missing ─────────────────────────
  const policyPath = path.join(config.dataDir, "policy.json");
  if (!fs.existsSync(policyPath)) {
    const defaultPolicy = PolicySchema.parse({});
    savePolicy(defaultPolicy);
  } else {
    logger.info(`Policy already exists: ${policyPath}`);
  }

  // ── Create wiki index if missing ─────────────────────────────
  const wikiIndex = path.join(config.wikiDir, "INDEX.md");
  if (!fs.existsSync(wikiIndex)) {
    fs.writeFileSync(wikiIndex, DEFAULT_WIKI_INDEX, "utf8");
    logger.success(`Created: ${wikiIndex}`);
  } else {
    logger.debug(`Exists: ${wikiIndex}`);
  }

  // ── Check keypair ─────────────────────────────────────────────
  if (!fs.existsSync(config.agentKeypairPath)) {
    logger.warn(`Agent keypair not found at: ${config.agentKeypairPath}`);
    logger.warn(
      `Generate one with: npx solana-keygen new --outfile agent-keypair.json`
    );
    logger.warn(
      `Then airdrop devnet SOL: npx solana airdrop 2 <pubkey> --url devnet`
    );
  } else {
    logger.success(`Agent keypair found: ${config.agentKeypairPath}`);
  }

  logger.section("Init Complete");
  logger.info("Next steps:");
  logger.raw("  1. Copy .env.example to .env and fill in your values");
  logger.raw("  2. Generate keypair: npx solana-keygen new --outfile agent-keypair.json");
  logger.raw("  3. Airdrop devnet SOL: guardian airdrop --sol 2");
  logger.raw("  4. Show policy: guardian policy show");
  logger.raw("  5. Run once: guardian run --once --dry-run");
  logger.blank();
}
