import chalk from "chalk";
import { loadConfig } from "../config/loadConfig";
import { loadDaemonState, saveDaemonState, increaseBackoff, resetBackoff } from "../daemon/daemon-state.store";
import { runOnce } from "./run";
import { sleep, nowIso } from "../utils/time";
import { logger } from "../utils/logger";
import { writeIncident } from "../wiki/wiki.incident";

function looksLikeRateLimit(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("429") || m.includes("rate limit") || m.includes("too many requests") || m.includes("fetch failed");
}

export async function runDaemon(opts: { interval?: string }): Promise<void> {
  const config = loadConfig();
  const baseInterval = Number(opts.interval ?? config.daemonIntervalSeconds);
  if (!Number.isFinite(baseInterval) || baseInterval < 10) {
    throw new Error("Daemon interval must be >= 10 seconds.");
  }

  logger.section("Guardian Daemon");
  logger.info(`Network               : ${config.solanaNetwork}`);
  logger.info(`Base interval         : ${baseInterval}s`);
  logger.info(`Failure halt threshold: ${config.failureHaltThreshold}`);
  logger.info(`Wiki hash anchoring   : ${config.wikiHashAnchorEnabled}`);
  logger.blank();

  let state = loadDaemonState();
  logger.info("Loaded daemon state:");
  logger.info(`Consecutive failures: ${state.consecutiveFailures}`);
  logger.info(`Backoff seconds     : ${state.backoffSeconds}`);

  while (true) {
    logger.section(`Daemon Cycle @ ${nowIso()}`);
    logger.info(`Consecutive failures: ${state.consecutiveFailures}`);
    logger.info(`Backoff seconds      : ${state.backoffSeconds}`);

    let cycleFailed = false;
    let failureReason = "";

    try {
      // NOTE: runOnce does snapshot→risk→plan→approve→execute→receipt+wiki
      // We pass in the daemon state so the risk engine can optionally trigger on it.
      const outcome = await runOnce({
        once: true,
        dryRun: false,
        runtime: {
          consecutiveFailures: state.consecutiveFailures,
          failureThreshold: config.failureHaltThreshold,
        },
      });

      // Based on our structured RunOutcome, did the agent succeed in its intention?
      if (!outcome.ok) {
        cycleFailed = true;
        failureReason = outcome.message || outcome.errorMessage || outcome.status;
      }
    } catch (err) {
      cycleFailed = true;
      failureReason = err instanceof Error ? err.message : String(err);
      logger.error(`Daemon cycle exception: ${failureReason}`);
    }

    if (cycleFailed) {
      state.consecutiveFailures += 1;
      state.lastFailureAt = nowIso();
      state.lastFailureReason = failureReason;

      // Backoff only for likely rate limits / network dropouts
      if (looksLikeRateLimit(failureReason)) {
        state = increaseBackoff(state);
        logger.warn(`Rate-limit/network flakiness detected. Increasing backoff to ${state.backoffSeconds}s`);
      }

      saveDaemonState(state);

      if (state.consecutiveFailures >= config.failureHaltThreshold) {
        const incidentId = `halt-${Date.now()}`;
        const incidentPath = writeIncident({
          incidentId,
          title: "Daemon halted due to repeated failures",
          details: [
            `Consecutive failures: ${state.consecutiveFailures}`,
            `Last failure at: ${state.lastFailureAt}`,
            `Last failure reason: \`${state.lastFailureReason}\``,
            ``,
            `Suggested actions:`,
            `- Check RPC health / switch RPC provider (\`SOLANA_RPC_URL\`)`,
            `- Check if \`OPENAI_API_KEY\` quota is exhausted`,
            `- Run: \`guardian wallet\` (confirm SOL fee balance)`,
            `- Run: \`guardian run --once\``,
          ].join("\n"),
        });

        logger.error(
          `\n[FATAL] HALTING daemon: consecutiveFailures=${state.consecutiveFailures} ` +
          `threshold=${config.failureHaltThreshold}`
        );
        logger.error(`Read Incident Report: ${incidentPath}\n`);
        process.exit(1);
      }
    } else {
      // Successful cycle: reset failure count and backoff
      if (state.consecutiveFailures > 0) {
        logger.success("Daemon cycle recovered — resetting consecutive failure counter.");
      }
      state.consecutiveFailures = 0;
      state.lastSuccessAt = nowIso();
      state = resetBackoff(state);

      saveDaemonState(state);
    }

    const sleepSeconds = baseInterval + (state.backoffSeconds ?? 0);
    logger.info(chalk.gray(`Sleeping for ${sleepSeconds}s...`));
    await sleep(sleepSeconds * 1000);
  }
}
