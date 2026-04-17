#!/usr/bin/env node
import { Command } from "commander";

// Phase 1
import { runInit } from "./commands/init";
import { runPolicyShow, runPolicySet } from "./commands/policy";

// Phase 2
import { runAirdrop } from "./commands/airdrop";
import { runWalletStatus } from "./commands/wallet";

// Phase 3
import { runPolicyValidate } from "./commands/policy.validate";
import { runPolicyHistory } from "./commands/policy.history";

// Phase 4
import { runRiskStatus } from "./commands/risk.status";
import { runRiskHistory } from "./commands/risk.history";

// Phase 5
import { runPlan } from "./commands/plan";

// Phase 6
import { runApprovalsList, runApprovalsShow } from "./commands/approvals";

// Phase 7
import { runOnce } from "./commands/run";

// Phase 8
import { runReceiptList, runReceiptShow, runReceiptProcess } from "./commands/receipt";

// Phase 13
import { initObservability } from "./observability/instrumentation";

// Observability must never break the CLI.
initObservability().catch(() => {});

// Phase 9
import { runVerifyReceipt } from "./commands/verify";

// Phase 10
import { runDaemon } from "./commands/daemon";

const program = new Command();

program
  .name("guardian")
  .description(
    "Policy-bound Solana wallet agent with verifiable receipts and LLM wiki audit log"
  )
  .version("0.10.0");

// ── guardian init ─────────────────────────────────────────────────────────
program
  .command("init")
  .description("Initialize Guardian: create directories, default policy, and wiki")
  .action(async () => {
    await runInit();
  });

// ── guardian airdrop ──────────────────────────────────────────────────────
program
  .command("airdrop")
  .description("Request devnet SOL airdrop")
  .option("--sol <amount>", "Amount of SOL to request", "2")
  .action(async (opts: { sol: string }) => {
    await runAirdrop(opts.sol);
  });

// ── guardian wallet ───────────────────────────────────────────────────────
program
  .command("wallet")
  .description("Show wallet address and balances (SOL + SPL tokens)")
  .action(async () => {
    await runWalletStatus();
  });

// ── guardian policy ───────────────────────────────────────────────────────
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

policyCmd
  .command("validate")
  .description("Dry-run a hypothetical action against current policy")
  .option("--scenario <id>", "Named test scenario to evaluate")
  .option("--all", "Run all built-in test scenarios")
  .action(async (opts: { scenario?: string; all?: boolean }) => {
    await runPolicyValidate(opts);
  });

policyCmd
  .command("history")
  .description("Show today's spend ledger")
  .action(async () => {
    await runPolicyHistory();
  });

// ── guardian risk ─────────────────────────────────────────────────────────
const riskCmd = program
  .command("risk")
  .description("Risk engine: snapshot wallet + evaluate triggers");

riskCmd
  .command("status")
  .description("Take a snapshot and evaluate current risk triggers")
  .action(async () => {
    await runRiskStatus();
  });

riskCmd
  .command("history")
  .description("Show recent price observations")
  .option("-n, --n <count>", "Number of recent observations to show", "20")
  .action(async (opts: { n?: string }) => {
    await runRiskHistory(opts);
  });

// ── guardian plan ─────────────────────────────────────────────────────────
program
  .command("plan")
  .description("Generate an LLM plan, run policy check, and optionally seek approval")
  .option("--reason <reason>", "Trigger reason passed to planner", "manual")
  .option("--dry-run", "Print plan + policy check only, skip approval prompt")
  .action(async (opts: { reason?: string; dryRun?: boolean }) => {
    await runPlan({
      reason: opts.reason,
      dryRun: opts.dryRun ?? false,
    });
  });

// ── guardian approvals ────────────────────────────────────────────────────
const approvalsCmd = program
  .command("approvals")
  .description("View approval history");

approvalsCmd
  .command("list")
  .description("List recent approval records")
  .option("-n, --n <count>", "Number of records to show", "20")
  .action(async (opts: { n?: string }) => {
    await runApprovalsList(opts);
  });

approvalsCmd
  .command("show")
  .description("Show a specific approval record")
  .requiredOption("--id <requestId>", "Approval request ID")
  .action(async (opts: { id: string }) => {
    await runApprovalsShow(opts.id);
  });

// ── guardian run ──────────────────────────────────────────────────────────
program
  .command("run")
  .description("Execute one full agent cycle: snapshot → risk → plan → approve → execute")
  .option("--once", "Run once and exit (default behavior)")
  .option("--dry-run", "Simulate execution without touching the chain")
  .option("--plan-id <id>", "Re-execute a previously saved + approved plan by ID")
  .action(async (opts: { once?: boolean; dryRun?: boolean; planId?: string }) => {
    await runOnce({
      once: opts.once ?? true,
      dryRun: opts.dryRun ?? false,
      planId: opts.planId,
    });
  });

// ── guardian receipt ──────────────────────────────────────────────────────
const receiptCmd = program
  .command("receipt")
  .description("Receipt management (local receipts + on-chain memo anchors)");

receiptCmd
  .command("list")
  .description("List recent receipts")
  .option("-n, --n <count>", "Number of receipts to show", "20")
  .action(async (opts: { n?: string }) => {
    await runReceiptList(opts);
  });

receiptCmd
  .command("show")
  .description("Show a receipt by hash")
  .requiredOption("--hash <hash>", "Receipt hash")
  .action(async (opts: { hash: string }) => {
    await runReceiptShow(opts.hash);
  });

receiptCmd
  .command("process")
  .description("Process a pending receipt (if present)")
  .action(async () => {
    await runReceiptProcess();
  });

program
  .command("daemon")
  .description("Run Guardian continuously (auto snapshot → plan → approve → execute)")
  .option("--interval <seconds>", "Base interval between cycles (seconds)", "60")
  .action(async (opts: { interval?: string }) => {
    await runDaemon(opts);
  });

program
  .command("verify")
  .description("Verify a receipt hash locally + on-chain memo anchor + action tx")
  .requiredOption("--receipt <hash>", "Receipt hash to verify")
  .action(async (opts: { receipt: string }) => {
    await runVerifyReceipt(opts.receipt);
  });

// ── Parse ─────────────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
