import { loadPolicy, formatPolicySummary, savePolicy } from "../policy/policy.store";
import { PolicySchema } from "../policy/policy.schema";
import { logger } from "../utils/logger";
import * as fs from "fs";

export async function runPolicyShow(): Promise<void> {
  logger.section("Current Policy");
  const policy = loadPolicy();
  logger.raw(formatPolicySummary(policy));
  logger.blank();
}

export async function runPolicySet(filePath: string): Promise<void> {
  logger.section("Set Policy");

  if (!fs.existsSync(filePath)) {
    logger.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error("File is not valid JSON.");
    process.exit(1);
  }

  const result = PolicySchema.safeParse(parsed);
  if (!result.success) {
    logger.error("Policy validation failed:");
    for (const issue of result.error.issues) {
      logger.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  savePolicy(result.data);
  logger.raw(formatPolicySummary(result.data));
  logger.blank();
}
