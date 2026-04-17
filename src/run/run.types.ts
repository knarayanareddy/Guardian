export type RunStatus =
  | "NO_TRIGGERS"
  | "NO_ACTION_PLAN"
  | "APPROVAL_REJECTED"
  | "POLICY_DENIED"
  | "EXECUTION_SUCCESS"
  | "EXECUTION_FAILURE"
  | "RECEIPT_FAILED"
  | "SNAPSHOT_FAILED"
  | "PLANNING_FAILED"
  | "DRY_RUN_DONE"
  | "UNKNOWN_ERROR";

export interface RunOutcome {
  runId: string;
  ok: boolean;                 // daemon uses this as the primary success/failure signal
  status: RunStatus;
  message: string;

  // Useful metadata for daemon-state + wiki/ops
  planId?: string;
  approvalRequestId?: string;

  actionTxSignature?: string;
  receiptHash?: string;
  anchorTxSignature?: string;

  // When ok=false, include an error detail for backoff classification
  errorMessage?: string;
}
