import chalk from "chalk";
import type { PolicyDecision } from "./policy.engine.types";

/**
 * Renders a PolicyDecision as a clean terminal block.
 * Used by guardian policy validate and approval prompts (Phase 6).
 */
export function formatPolicyDecision(d: PolicyDecision): string {
  const lines: string[] = [];

  // ── Status banner ──────────────────────────────────────────
  const statusLine =
    d.status === "ALLOWED"
      ? chalk.green(`✓ ALLOWED`)
      : d.status === "REQUIRES_APPROVAL"
      ? chalk.yellow(`⚠ REQUIRES APPROVAL`)
      : chalk.red(`✗ DENIED`);

  lines.push(statusLine);
  lines.push(`  Evaluated at : ${d.evaluatedAt}`);
  lines.push(`  Policy hash  : ${d.policyHash.slice(0, 16)}...`);
  lines.push(`  Today spent  : ${(d.todaySpentLamports / 1e9).toFixed(6)} SOL`);
  lines.push(`  Daily remain : ${(d.todayRemainingLamports / 1e9).toFixed(6)} SOL`);

  // ── Input summary ──────────────────────────────────────────
  lines.push("");
  lines.push("  Action:");
  if ("fromMint" in d.input) {
    // swap
    const s = d.input;
    lines.push(`    type       : swap`);
    lines.push(`    fromMint   : ${s.fromMint}`);
    lines.push(`    toMint     : ${s.toMint}`);
    lines.push(`    amount     : ${(s.inputAmountLamports / 1e9).toFixed(6)} SOL`);
    lines.push(`    slippage   : ${s.slippageBps / 100}%`);
    if (s.estimatedRiskScore !== undefined) {
      lines.push(`    risk score : ${s.estimatedRiskScore.toFixed(2)}`);
    }
  } else {
    // transfer
    const t = d.input;
    lines.push(`    type        : transfer`);
    lines.push(`    mint        : ${t.mint}`);
    lines.push(`    destination : ${t.destinationAddress}`);
    lines.push(`    amount      : ${(t.amountLamports / 1e9).toFixed(6)} SOL`);
    if (t.estimatedRiskScore !== undefined) {
      lines.push(`    risk score  : ${t.estimatedRiskScore.toFixed(2)}`);
    }
  }

  // ── Violations ────────────────────────────────────────────
  if (d.violations.length > 0) {
    lines.push("");
    lines.push(chalk.red(`  Violations (${d.violations.length}):`));
    for (const v of d.violations) {
      lines.push(chalk.red(`    ✗ [${v.rule}] ${v.detail}`));
    }
  }

  // ── Approval reasons ──────────────────────────────────────
  if (d.approvalReasons.length > 0) {
    lines.push("");
    lines.push(chalk.yellow(`  Approval required because:`));
    for (const r of d.approvalReasons) {
      lines.push(chalk.yellow(`    ⚠ ${r}`));
    }
  }

  return lines.join("\n");
}
