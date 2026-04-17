import * as fs from "fs";
import * as path from "path";
import { PolicySchema, type Policy } from "./policy.schema";
import { loadConfig } from "../config/loadConfig";
import { canonicalJson } from "../utils/jsonStable";
import { logger } from "../utils/logger";

// SHA-256 for policy hashing
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Sha256 = require("sha.js/sha256");

function sha256hex(input: string): string {
  return new Sha256().update(input, "utf8").digest("hex") as string;
}

function getPolicyPath(): string {
  const config = loadConfig();
  return path.join(config.dataDir, "policy.json");
}

/**
 * Load and validate policy from disk.
 */
export function loadPolicy(): Policy {
  const policyPath = getPolicyPath();

  if (!fs.existsSync(policyPath)) {
    throw new Error(
      `Policy file not found at ${policyPath}. Run: guardian init`
    );
  }

  const raw = fs.readFileSync(policyPath, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Policy file is not valid JSON: ${policyPath}`);
  }

  const result = PolicySchema.safeParse(parsed);
  if (!result.success) {
    logger.error("Policy validation failed:");
    for (const issue of result.error.issues) {
      logger.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Invalid policy file. Fix errors above and retry.");
  }

  return result.data;
}

/**
 * Compute a stable hash of a policy object.
 * Used to include in receipts so you can prove which policy was in effect.
 */
export function hashPolicy(policy: Policy): string {
  const canonical = canonicalJson(policy);
  return sha256hex(canonical);
}

/**
 * Save a policy object to disk.
 */
export function savePolicy(policy: Policy): void {
  const policyPath = getPolicyPath();

  // Validate before saving
  const result = PolicySchema.safeParse(policy);
  if (!result.success) {
    throw new Error("Cannot save invalid policy object.");
  }

  // Ensure dir exists
  const dir = path.dirname(policyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(policyPath, JSON.stringify(result.data, null, 2), "utf8");
  logger.success(`Policy saved to ${policyPath}`);
  logger.info(`Policy hash: ${hashPolicy(result.data)}`);
}

/**
 * Return a pretty-printed policy summary for logging/CLI display.
 */
export function formatPolicySummary(policy: Policy): string {
  const hash = hashPolicy(policy);
  const lines = [
    `Policy v${policy.version} (hash: ${hash.slice(0, 16)}...)`,
    `  Max single action : ${(policy.maxSingleActionLamports / 1e9).toFixed(4)} SOL`,
    `  Daily spend cap   : ${(policy.dailySpendCapLamports / 1e9).toFixed(4)} SOL`,
    `  Max slippage      : ${policy.maxSlippageBps / 100}%`,
    `  Allowed actions   : ${policy.allowedActions.join(", ")}`,
    `  Allowed mints     : ${policy.allowedMints.length === 0 ? "ALL" : policy.allowedMints.length + " listed"}`,
    `  Deny mints        : ${policy.denyMints.length}`,
    `  Allowed dests     : ${policy.allowedDestinations.length === 0 ? "ANY" : policy.allowedDestinations.length + " listed"}`,
    `  Drawdown trigger  : ${policy.drawdownTrigger.enabled ? `enabled (${policy.drawdownTrigger.thresholdPct}% in ${policy.drawdownTrigger.windowMinutes}min → ${policy.drawdownTrigger.deRiskAction})` : "disabled"}`,
    `  Approval required : overLamports=${policy.requireApprovalIf.overLamports ? (policy.requireApprovalIf.overLamports / 1e9).toFixed(4) + " SOL" : "none"}, newMint=${policy.requireApprovalIf.newMint ?? false}, riskScore>${policy.requireApprovalIf.riskScoreAbove ?? "N/A"}`,
  ];
  return lines.join("\n");
}
