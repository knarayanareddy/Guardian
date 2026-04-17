import chalk from "chalk";
import type { Plan } from "./plan.schema";
import type { PolicyDecision } from "../policy/policy.engine.types";
import { formatPolicyDecision } from "../policy/policy.decision.format";

/**
 * Renders a Plan as a clean terminal block.
 */
export function formatPlan(plan: Plan): string {
  const lines: string[] = [];

  lines.push(chalk.cyan(`◆ Plan: ${plan.label}`));
  lines.push(`  Plan ID       : ${plan.planId}`);
  lines.push(`  Action type   : ${chalk.bold(plan.actionType)}`);
  lines.push(`  Confidence    : ${(plan.confidence * 100).toFixed(0)}%`);
  lines.push(`  Trigger reason: ${plan.triggerReason}`);
  lines.push("");
  lines.push(`  Reasoning:`);
  lines.push(`    ${plan.reasoning}`);
  lines.push("");

  // ── Action params ────────────────────────────────────────────────────────
  if (plan.actionType === "swap" && plan.swapParams) {
    const s = plan.swapParams;
    lines.push("  Swap parameters:");
    lines.push(`    From mint   : ${s.fromMint}`);
    lines.push(`    To mint     : ${s.toMint}`);
    lines.push(`    Amount      : ${(s.inputAmountLamports / 1e9).toFixed(6)} SOL (${s.inputAmountLamports} lamports)`);
    lines.push(`    Slippage    : ${s.slippageBps} bps (${s.slippageBps / 100}%)`);
    lines.push("");
  } else if (plan.actionType === "transfer" && plan.transferParams) {
    const t = plan.transferParams;
    lines.push("  Transfer parameters:");
    lines.push(`    Mint        : ${t.mint}`);
    lines.push(`    Destination : ${t.destinationAddress}`);
    lines.push(`    Amount      : ${(t.amountLamports / 1e9).toFixed(6)} SOL (${t.amountLamports} lamports)`);
    lines.push("");
  } else if (plan.actionType === "none") {
    lines.push(chalk.green("  No action required."));
    lines.push("");
  } else if (plan.actionType === "halt") {
    lines.push(chalk.red("  ⚠ HALT — manual intervention required."));
    lines.push("");
  }

  // ── Risks ────────────────────────────────────────────────────────────────
  if (plan.risks.length > 0) {
    lines.push("  Risks:");
    for (const r of plan.risks) {
      lines.push(chalk.yellow(`    ⚠ ${r}`));
    }
    lines.push("");
  }

  // ── Tags ─────────────────────────────────────────────────────────────────
  if (plan.receiptTags.length > 0) {
    lines.push(`  Receipt tags  : ${plan.receiptTags.map((t) => `#${t}`).join("  ")}`);
  }

  return lines.join("\n");
}

/**
 * Renders a Plan + PolicyDecision bundle.
 */
export function formatPlanBundle(plan: Plan, decision: PolicyDecision): string {
  const lines = [
    formatPlan(plan),
    "",
    chalk.bold("─── Policy Check ───"),
    "",
    formatPolicyDecision(decision),
  ];
  return lines.join("\n");
}
