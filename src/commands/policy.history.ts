import { formatTodaySpendSummary } from "../policy/spend-ledger.store";
import { logger } from "../utils/logger";

export async function runPolicyHistory(): Promise<void> {
  logger.section("Today's Spend Ledger");
  logger.raw(formatTodaySpendSummary());
  logger.blank();
}
