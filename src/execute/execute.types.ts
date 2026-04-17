import type { Plan } from "../planner/plan.schema";
import type { ApprovalDecision } from "../approvals/approval.types";
import type { PolicyDecision } from "../policy/policy.engine.types";
import type { WalletSnapshot } from "../state/snapshot.schema";

// ── Input to the executor ──────────────────────────────────────────────────

export interface ExecutionInput {
  plan: Plan;
  approvalDecision: ApprovalDecision;
  policyDecision: PolicyDecision;
  snapshotAtPlan: WalletSnapshot;   // snapshot taken during planning phase
  isSimulation: boolean;            // true = dry run, never touches chain
}

// ── Per-attempt record ─────────────────────────────────────────────────────

export interface ExecutionAttempt {
  attemptNumber: number;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  txSignature?: string;
  errorMessage?: string;
  errorCode?: string;
}

// ── Successful result ──────────────────────────────────────────────────────

export interface ExecutionSuccess {
  status: "success";
  txSignature: string;
  confirmedAt: string;
  explorerUrl: string;
  solscanUrl: string;
  attempts: ExecutionAttempt[];
  lamportsSpent: number;    // what was actually debited (for spend ledger)
  isSimulation: boolean;
}

// ── Failed result ──────────────────────────────────────────────────────────

export type ExecutionFailureReason =
  | "pre_flight_denied"       // final policy re-check denied the action
  | "approval_missing"        // approval record says not approved
  | "simulation_error"        // simulated execution returned error
  | "tx_send_failed"          // RPC rejected the transaction
  | "tx_confirm_timeout"      // tx sent but not confirmed in time
  | "tx_execution_failed"     // tx confirmed but instruction failed on-chain
  | "max_retries_exceeded"    // exceeded maxTxRetries
  | "unknown";

export interface ExecutionFailure {
  status: "failure";
  reason: ExecutionFailureReason;
  message: string;
  attempts: ExecutionAttempt[];
  isSimulation: boolean;
}

// ── Union result ───────────────────────────────────────────────────────────

export type ExecutionResult = ExecutionSuccess | ExecutionFailure;

// ── Type guards ────────────────────────────────────────────────────────────

export function isExecutionSuccess(r: ExecutionResult): r is ExecutionSuccess {
  return r.status === "success";
}

export function isExecutionFailure(r: ExecutionResult): r is ExecutionFailure {
  return r.status === "failure";
}
