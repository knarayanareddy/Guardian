# Guardian — remediation plan

Planned work only; nothing here was executed. All future rehearsals require owner authorization and isolated fixtures, fake signers and controlled network substitutes. No live wallet, chain or provider operations are authorized by this review. Findings and evidence: [review](REVIEW.md).

## Phase 0 — establish authority and baseline

**Entry:** pinned evidence and owner availability. **Exit:** T1's source-backed authority map and permitted-mode decisions are approved; unknowns remain explicitly marked.

**GDN-T1** (GDN-1, GDN-2, GDN-5; prerequisites: none; observed `src/config/loadConfig.ts`, `src/approvals/approval.engine.ts`, `src/commands/run.ts`, `src/execute/execute.ts`)
1. Trace CLI, approval, policy, execution and receipt paths, including all branches and configuration overrides; record the actual effective mode and network separately from defaults.
2. Describe `always`, `policyOnly` and devnet `never`, including denial/no-action branches, and identify who controls configuration, policy, keys and shutdown.
3. Have the owner define permitted networks, approval authority and deployment scope; flag RPC-to-chain identity as unresolved until measured.

Deliverable: source-backed authority and data-flow record. Verification: another reviewer traces each boundary to a pinned call site and confirms defaults versus overrides. DoD: [ ] routes and exceptions mapped; [ ] unknowns listed; [ ] owner decisions recorded.

## Phase 1 — bind the executable intent

**Entry:** T1 approved. **Exit:** T2 tests prove legitimate approval works and mismatched intent is rejected at the actual signer boundary.

**GDN-T2** (GDN-2; after T1; observed `src/execute/execute.ts`, `src/execute/execute.guard.ts`, `src/execute/execute.swap.ts`, `src/execute/execute.transfer.ts`; signer implementation location to be identified)
1. Inspect swap, transfer, signer construction and all paths to signing. Record where request identity, policy, network and each transaction parameter enter or change; these downstream contents were not reviewed here.
2. Specify and implement an owner-approved canonical intent binding for all material effects, including recipient, asset, amount, permitted fee/slippage, network and signer as applicable. Distinguish operator-approved invariants from chain-generated or refreshed fields, and define bounded acceptable variation rather than claiming every byte is fixed.
3. At the real signing boundary validate the binding and request identity, expiry, replay and actual network context; test legitimate swap and transfer fixtures as well as mutations and stale/wrong-network approvals with a fake signer.

Deliverable: documented binding design, implementation and deterministic tests. Verification: a legitimate approved fixture reaches the fake signer; each changed protected field is rejected and the test **passes** because rejection occurred. Separately disable or break the binding guard and show the same negative test **fails**. DoD: [ ] signer paths traced; [ ] valid cases pass; [ ] mutated/stale/wrong-context cases rejected; [ ] guard mutation detected.

## Phase 2 — preserve audit history and build gates

**Entry:** T1 and T2 complete. **Exit:** T3's malformed-history and reproducibility checks pass and an intentionally broken guard is caught in CI or an equivalent isolated rehearsal.

**GDN-T3** (GDN-3, GDN-4; after T1/T2; observed `src/approvals/approval.store.ts`, `package.json`, `.github/workflows/ci.yml`; test locations and scripts proposed)
1. Change malformed and non-array history handling to stop writes and fail closed, preserving or quarantining original bytes with an actionable operator error; distinguish absent history from corruption.
2. Define an owner-reviewed recovery procedure using a verified backup or preserved file; test malformed JSON, wrong shape, append attempts, and successful isolated recovery, including exact original bytes remaining available.
3. Reconcile the lockfile with the manifest, review dependency changes, and use a lockfile-enforcing clean install in CI. Define and wire real policy, approval, execution and receipt test scripts; do not silently change thresholds or assume such scripts already exist.

Deliverable: preservation/recovery implementation, reproducible lockfile and first-class behavioral gates. Verification: corrupt fixtures cannot be overwritten or accepted as empty history; compare recovered records to the fixture. In a disposable checkout, a deliberately mismatched lockfile must fail the install gate, and an intentionally broken safety guard must fail its test. DoD: [ ] corrupt bytes preserved; [ ] isolated recovery observed; [ ] lock drift fails; [ ] safety tests run in CI.

## Phase 3 — security, operations and recovery

**Entry:** T1–T3 complete. **Exit:** T4 produces observed isolated stop, restore and post-action receipt-recovery outcomes, with unresolved risks assigned.

**GDN-T4** (GDN-3, GDN-5; preventive security requirements; after T1/T2/T3; observed `src/approvals/approval.store.ts`, `src/commands/run.ts`, `src/receipts/receipt.anchor.ts`; proposed recovery procedure)
1. Inspect authorization of policy edits, model-influenced inputs, secret exposure in logs/receipts, dependency integrity and data retention; record risk owners and key-custody controls without assuming current protections.
2. Design a durable action/receipt reconciliation state machine: distinguish not sent, confirmed action, uncertain submission and receipt-only failure. Preserve action identifiers; if status is unknown, stop and reconcile rather than replay the action. Receipt retry must not re-submit the original action. Account for failure while saving pending state as well as later processing.
3. In an isolated fixture with fake provider/signer, inject a successful action followed by receipt failure, restart and recover receipt processing; verify exactly one simulated action submission and preserved identifiers. Rehearse stop and a backup restore into a clean location, compare approval/receipt state and record actual observations.

Deliverable: security decisions, recovery design and rehearsal evidence. Verification: retain fixture setup, event trace, original/restored state comparison and stop observation; test an ambiguous submission without blind retry. A failed receipt cannot prevent an already successful action. DoD: [ ] security owners assigned; [ ] post-action recovery observed without duplicate action; [ ] uncertain status halts; [ ] isolated stop and restore observed.

## Phase 4 — human interface and accessibility

**Entry:** T1–T4 complete. **Exit:** T5's CLI review is complete; any dashboard work is conditional on an owner-approved, inspected surface.

**GDN-T5** (GDN-1, preventive usability requirement; after T1/T2/T3/T4; observed `src/approvals/approval.cli.ts`, `src/approvals/approval.format.ts`, `README.md`; dashboard approval view proposed, existence unverified)
1. Inspect the actual CLI rendering and any dashboard approval flow before changing them; ask the owner whether a dashboard approval view exists or should be built.
2. Show the approved intent, network, recipient, asset, amount, material fees and irreversibility where applicable; describe both automatic approval modes accurately and update the README diagram.
3. Exercise keyboard, rejection, abort, timeout and accessible output with representative users or tools. Apply equivalent tests to a dashboard only if the owner approves it and its surface is verified or created.

Deliverable: corrected operator copy and accessibility results. Verification: a reviewer identifies the action and context before approval and can reject or time out; conditional dashboard results are labeled separately. DoD: [ ] CLI wording checked; [ ] mode exceptions documented; [ ] accessibility findings recorded; [ ] dashboard scope decided.

## Phase 5 — independent acceptance

**Entry:** T1–T5 complete, including explicit resolution or owner acceptance of open risks. **Exit:** an independent reviewer records reproducible evidence and an accept/reject decision; acceptance does not certify production safety.

**GDN-T6** (independent acceptance; after T1–T5; observed paths as above; acceptance artifact location proposed)
1. Give a reviewer not involved in the changes the revision, dependency lock, test instructions, approved intent specification and redacted fixture artifacts.
2. Have that reviewer independently repeat valid and mutated-intent tests, the intentionally broken-guard test, malformed-history recovery, stop/restore and receipt-failure/no-duplicate rehearsal using isolated substitutes.
3. Compare observations against each phase gate, document discrepancies and obtain the owner's explicit release decision; return failures to their owning task rather than weakening checks.

Deliverable: reproducible independent acceptance record with artifact references and decision. Verification: reviewer signs and dates the results, including failures and environment; owner acknowledges unresolved risk. DoD: [ ] independent reviewer identified; [ ] required rehearsals observed; [ ] defects resolved or explicitly accepted; [ ] decision recorded.

## Dependencies and release

| Task | Prerequisites | Output |
|---|---|---|
| T1 | — | authority and mode decisions |
| T2 | T1 | approved-intent binding |
| T3 | T1, T2 | history preservation and CI gates |
| T4 | T1, T2, T3 | security and observed recovery |
| T5 | T1, T2, T3, T4 | accessible operator flow |
| T6 | T1, T2, T3, T4, T5 | independent acceptance |

**Production acceptance:** [ ] all phase exits evidenced; [ ] owner approves network, signer custody, mode/policy changes and recovery; [ ] actual chain identity and deployment controls independently validated before any proposed live release; [ ] no unreviewed dashboard authority assumed.

**Release and rollback:** Changes to approval modes, thresholds, signer/network rules, custody, dashboard authority or any live-network rehearsal require owner approval. Release only a reviewed artifact with a documented stop and recovery decision. Roll back by stopping new signings and restoring a verified prior artifact and state where safe; never claim that rollback reverses an already broadcast action. Reconcile uncertain actions before resuming.
