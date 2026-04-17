import { formatPriceHistorySummary } from "../state/price-history.store";
import { logger } from "../utils/logger";

export async function runRiskHistory(opts: { n?: string }): Promise<void> {
  logger.section("Price History");

  const n = Math.min(Math.max(Number(opts.n ?? "20"), 1), 200);
  logger.raw(formatPriceHistorySummary(n));
  logger.blank();
}
