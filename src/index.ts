#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init";
import { runPolicyShow, runPolicySet } from "./commands/policy";
import { runAirdrop } from "./commands/airdrop";
import { runWalletStatus } from "./commands/wallet";

const program = new Command();

program
  .name("guardian")
  .description("Policy-bound Solana wallet agent with verifiable receipts and LLM wiki audit log")
  .version("0.1.0");

// ── guardian init ────────────────────────────────────────────────
program
  .command("init")
  .description("Initialize Guardian: create directories, default policy, and wiki")
  .action(async () => {
    await runInit();
  });

// ── guardian policy ──────────────────────────────────────────────
const policyCmd = program
  .command("policy")
  .description("Manage the Guardian policy");

policyCmd
  .command("show")
  .description("Display the current policy")
  .action(async () => {
    await runPolicyShow();
  });

policyCmd
  .command("set")
  .description("Load a policy from a JSON file")
  .requiredOption("--file <path>", "Path to policy JSON file")
  .action(async (opts: { file: string }) => {
    await runPolicySet(opts.file);
  });

// ── guardian airdrop ─────────────────────────────────────────────
program
  .command("airdrop")
  .description("Request devnet SOL airdrop")
  .option("--sol <amount>", "Amount of SOL to request", "2")
  .action(async (opts: { sol: string }) => {
    await runAirdrop(opts.sol);
  });

// ── guardian wallet ──────────────────────────────────────────────
program
  .command("wallet")
  .description("Show wallet address and balances (SOL + SPL tokens)")
  .action(async () => {
    await runWalletStatus();
  });

program
  .command("plan")
  .description("Produce a plan without executing (Phase 5)")
  .option("--reason <reason>", "Reason for planning", "manual")
  .option("--dry-run", "Dry run mode (no execution)")
  .action(() => {
    console.log("[Phase 5] plan command — coming in Phase 5");
  });

program
  .command("run")
  .description("Execute one full agent cycle (Phase 7)")
  .option("--once", "Run once and exit")
  .option("--dry-run", "Dry run: plan but do not execute")
  .action(() => {
    console.log("[Phase 7] run command — coming in Phase 7");
  });

program
  .command("daemon")
  .description("Run the agent in a continuous loop (Phase 10)")
  .option("--interval <seconds>", "Interval between cycles in seconds", "60")
  .action(() => {
    console.log("[Phase 10] daemon command — coming in Phase 10");
  });

program
  .command("verify")
  .description("Verify a receipt hash on-chain (Phase 9)")
  .requiredOption("--receipt <hash>", "Receipt hash to verify")
  .action(() => {
    console.log("[Phase 9] verify command — coming in Phase 9");
  });

// ── Parse ────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
