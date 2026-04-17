import chalk from "chalk";
import type { ApprovalRequest } from "./approval.types";
import { formatPlan } from "../planner/plan.format";
import { formatPolicyDecision } from "../policy/policy.decision.format";
import { formatRiskReport } from "../risk/risk.format";

/**
 * Full approval request display for CLI prompt.
 * Shows: plan summary, policy decision, risk report,
 * approval context, and prompt instructions.
 */
export function formatApprovalRequest(req: ApprovalRequest): string {
  const lines: string[] = [];

  const border = chalk.yellow("═".repeat(64));

  lines.push(border);
  lines.push(chalk.yellow(`  ⚠  APPROVAL REQUIRED`));
  lines.push(chalk.yellow(`     Request ID   : ${req.requestId}`));
  lines.push(chalk.yellow(`     Created at   : ${req.createdAt}`));
  lines.push(chalk.yellow(`     Approval mode: ${req.approvalMode}`));
  lines.push(chalk.yellow(`     Routing      : ${req.routing}`));
  lines.push(border);

  lines.push("");
  lines.push(chalk.bold("PLAN:"));
  lines.push(formatPlan(req.plan));

  lines.push("");
  lines.push(chalk.bold("POLICY DECISION:"));
  lines.push(formatPolicyDecision(req.policyDecision));

  lines.push("");
  lines.push(chalk.bold("RISK REPORT:"));
  lines.push(formatRiskReport(req.riskReport));

  lines.push("");
  lines.push(border);
  lines.push(
    chalk.bold(
      "  Respond: " +
      chalk.green("y") + " = approve   " +
      chalk.red("n") + " = reject   " +
      chalk.cyan("d") + " = details   " +
      chalk.gray("a") + " = abort"
    )
  );
  lines.push(border);

  return lines.join("\n");
}

/**
 * Short single-line summary for auto-approval/denial messages.
 */
export function formatApprovalOneLiner(
  approved: boolean,
  reason: string,
  by: string
): string {
  const icon = approved ? chalk.green("✓") : chalk.red("✗");
  const label = approved ? chalk.green("APPROVED") : chalk.red("NOT APPROVED");
  return `${icon} ${label}  by=${by}  reason="${reason}"`;
}
