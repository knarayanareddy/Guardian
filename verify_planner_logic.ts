import { PlanSchema } from "./src/planner/plan.schema";

const mockResponse = `
Here is the plan:
\`\`\`json
{
  "planId": "plan-auto",
  "label": "Refill SOL to maintain operational capacity",
  "reasoning": "The current SOL balance is 0, which is below the safe threshold of 50,000 lamports. Refilling is necessary for transaction fees.",
  "actionType": "none",
  "confidence": 1.0,
  "risks": ["Out of gas"],
  "receiptTags": ["low-sol", "refill"],
  "triggerReason": "low_sol"
}
\`\`\`
`;

function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found");
  }
  text = text.slice(start, end + 1);
  return JSON.parse(text);
}

try {
  const parsed = extractJson(mockResponse);
  const result = PlanSchema.safeParse(parsed);
  if (result.success) {
    console.log("JSON extraction and Zod validation: SUCCESS");
    console.log("Plan label:", result.data.label);
  } else {
    console.error("Zod validation FAILED:", result.error.issues);
  }
} catch (err) {
  console.error("Test FAILED:", err);
}
