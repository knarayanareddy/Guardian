import * as fs from "fs";
import * as path from "path";
import type { Plan } from "./plan.schema";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";

/**
 * Persist a plan to disk so receipt + wiki phases can reference it.
 * Plans are saved to data/runs/<planId>.json
 */
export function savePlan(plan: Plan): string {
  const config = loadConfig();
  const dir = path.join(config.dataDir, "runs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${plan.planId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(plan, null, 2), "utf8");
  logger.debug(`Plan saved: ${filePath}`);
  return filePath;
}

/**
 * Load a plan by planId.
 */
export function loadPlan(planId: string): Plan | null {
  const config = loadConfig();
  const filePath = path.join(config.dataDir, "runs", `${planId}.json`);

  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as Plan;
  } catch {
    logger.warn(`Could not load plan: ${filePath}`);
    return null;
  }
}

/**
 * List recent plans (sorted newest first, capped at n).
 */
export function listRecentPlans(n = 10): Plan[] {
  const config = loadConfig();
  const dir = path.join(config.dataDir, "runs");
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("plan-") && f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, n);

  const plans: Plan[] = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      plans.push(JSON.parse(raw) as Plan);
    } catch {
      // skip malformed
    }
  }

  return plans;
}
