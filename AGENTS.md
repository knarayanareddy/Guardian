# Guardian — Agent Constitution (AGENTS.md)

## What this project is
Guardian is a policy-bound Solana wallet agent.
It observes on-chain state, produces plans, enforces hard policy constraints,
executes on-chain actions, anchors verifiable receipts via SPL Memo, and
writes human-readable wiki entries.

## Core contract (never break these)
1. The policy engine is DETERMINISTIC. It never calls an LLM.
   It evaluates actions against data/policy.json purely in code.
2. Receipts are ALWAYS written — even on failure.
3. Private keys are NEVER logged, printed, stored in wiki/receipts, or
   included in any string that goes to the LLM.
4. Anchoring uses the SPL Memo program. No custom on-chain programs in MVP.
5. Only Token plugin is loaded in MVP (keeps LLM tool surface minimal).
6. Plan step and Execute step are ALWAYS separate. Never merge them.

## Repo layout
src/config/          loadConfig.ts — typed env loading (Phase 1)
src/solana/          makeAgent, memo, addresses (Phase 2)
src/policy/          schema, store, engine (Phase 3)
src/risk/            engine, types (Phase 4)
src/planner/         schema, LLM call, prompts (Phase 5)
src/approvals/       engine, CLI prompts (Phase 6)
src/execute/         execute.ts, types (Phase 7)
src/receipts/        schema, hash, store, anchor (Phase 8)
src/wiki/            write, hash (Phase 9)
src/state/           snapshot, balances (Phase 4)
src/utils/           logger, time, jsonStable, scanPromptInjection

## Naming conventions
- All types are PascalCase interfaces/types exported from their module.
- All functions are camelCase.
- All file names are camelCase.
- Zod schemas are named with Schema suffix: PolicySchema, PlanSchema etc.
- Constants are UPPER_SNAKE_CASE.

## TypeScript rules
- Strict mode is ON.
- Never use `any`. Use `unknown` and narrow.
- All async functions must handle errors and either re-throw typed errors
  or return a Result type.
- No floating promises. Always await or void explicitly.

## Key dependencies
- solana-agent-kit v2 + @solana-agent-kit/plugin-token
- @solana/web3.js (for direct RPC + memo tx construction)
- @solana/spl-memo (for memo program id + instruction)
- ai + @ai-sdk/openai (Vercel AI SDK for LLM calls)
- zod (all schema validation)
- commander (CLI)
- chalk + ora (terminal UX)
- fast-json-stable-stringify (canonical JSON for hashing)
- sha.js (SHA-256 hashing)

## Environment
- Target: Solana devnet only in MVP
- Node: >= 20
- Runtime: ts-node for development

## Do not
- Do not install new dependencies without updating AGENTS.md.
- Do not call the LLM from policy engine, execute, or receipt modules.
- Do not write the private key anywhere outside src/solana/makeAgent.ts.
- Do not merge plan and execute phases into one function.
