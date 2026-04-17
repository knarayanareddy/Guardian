import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { PlanSchema, type Plan } from "./plan.schema";
import { buildSystemPrompt, buildUserPrompt, buildRetryPrompt } from "./plan.prompts";
import type { WalletSnapshot } from "../state/snapshot.schema";
import type { RiskReport } from "../risk/risk.types";
import type { Policy } from "../policy/policy.schema";
import { loadConfig } from "../config/loadConfig";
import { scanPromptInjection } from "../utils/scanPromptInjection";
import { logger } from "../utils/logger";
import { makeRunId, nowIso } from "../utils/time";

// ── Config ─────────────────────────────────────────────────────────────────

const MODEL_ID = "gpt-4o";
const MAX_TOKENS = 800;
const MAX_RETRIES = 2;
const TEMPERATURE = 0.2; // Low temperature for deterministic JSON output

// ── Parse LLM response to JSON ─────────────────────────────────────────────

/**
 * Extract and parse JSON from LLM response text.
 */
function extractJson(raw: string): unknown {
  let text = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }

  // Find first { and last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || start === -1 || end < start) {
    throw new Error("No JSON object found in LLM response");
  }

  text = text.slice(start, end + 1);

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse JSON from LLM response: ${String(err)}`);
  }
}

// ── Validate parsed JSON against Plan schema ───────────────────────────────

function validatePlan(parsed: unknown): { plan: Plan; errors: string[] } {
  const result = PlanSchema.safeParse(parsed);
  if (result.success) {
    return { plan: result.data, errors: [] };
  }
  const errors = result.error.issues.map(
    (i) => `${i.path.join(".")}: ${i.message}`
  );
  return { plan: undefined as unknown as Plan, errors };
}

// ── Injection scan on trigger reason ──────────────────────────────────────

/**
 * Sanitize trigger reason before it enters the prompt.
 */
function sanitizeTriggerReason(raw: string): string {
  const scan = scanPromptInjection(raw, "triggerReason");
  if (!scan.clean) {
    logger.warn(
      `Prompt injection detected in triggerReason (${scan.findings.length} findings). ` +
      `Replacing with safe string.`
    );
    return "manual_trigger";
  }
  return raw;
}

// ── Public planner function ────────────────────────────────────────────────

export interface PlanResult {
  plan: Plan;
  attempts: number;
  rawResponses: string[];
  plannedAt: string;
}

export async function generatePlan(params: {
  snapshot: WalletSnapshot;
  riskReport: RiskReport;
  policy: Policy;
  triggerReason: string;
}): Promise<PlanResult> {
  const config = loadConfig();

  if (!config.openAiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Cannot run planner. " +
      "Set it in .env and restart."
    );
  }

  const openai = createOpenAI({ apiKey: config.openAiApiKey });
  const model = openai(MODEL_ID);

  const systemPrompt = buildSystemPrompt();
  const cleanReason = sanitizeTriggerReason(params.triggerReason);

  const userPrompt = buildUserPrompt({
    snapshot: params.snapshot,
    riskReport: params.riskReport,
    policy: params.policy,
    triggerReason: cleanReason,
  });

  const rawResponses: string[] = [];
  let attempts = 0;
  let lastErrors: string[] = [];
  let lastRaw = "";
  let currentUserPrompt = userPrompt;

  // ── Retry loop ───────────────────────────────────────────────────────────
  while (attempts <= MAX_RETRIES) {
    attempts++;
    logger.debug(`Plan attempt ${attempts}/${MAX_RETRIES + 1}`);

    let responseText: string;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: currentUserPrompt,
        maxOutputTokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      });
      responseText = result.text;
    } catch (err) {
      throw new Error(`LLM API call failed on attempt ${attempts}: ${String(err)}`);
    }

    rawResponses.push(responseText);
    lastRaw = responseText;

    logger.debug(`LLM raw response (attempt ${attempts}):`, responseText.slice(0, 300));

    // ── Extract JSON ───────────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = extractJson(responseText);
    } catch (err) {
      lastErrors = [String(err)];
      logger.warn(`Attempt ${attempts}: JSON extraction failed — ${String(err)}`);
      if (attempts <= MAX_RETRIES) {
        currentUserPrompt = buildRetryPrompt(responseText, lastErrors);
      }
      continue;
    }

    // ── Validate schema ────────────────────────────────────────────────────
    const { plan, errors } = validatePlan(parsed);
    if (errors.length === 0) {
      // Override planId with a server-generated one
      plan.planId = `plan-${makeRunId()}`;

      logger.success(`Plan generated on attempt ${attempts}: ${plan.label}`);

      return {
        plan,
        attempts,
        rawResponses,
        plannedAt: nowIso(),
      };
    }

    lastErrors = errors;
    logger.warn(`Attempt ${attempts}: schema validation failed (${errors.length} errors)`);
    for (const e of errors) {
      logger.warn(`  schema error: ${e}`);
    }

    if (attempts <= MAX_RETRIES) {
      currentUserPrompt = buildRetryPrompt(lastRaw, lastErrors);
    }
  }

  // All retries exhausted
  throw new Error(
    `Planner failed after ${attempts} attempt(s). Last schema errors:\n` +
    lastErrors.map((e) => `  - ${e}`).join("\n")
  );
}
