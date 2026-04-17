/**
 * Prompt injection scanner.
 *
 * Inspired by Hermes Agent's documented context-file scanning:
 * scans text for known prompt injection / override patterns
 * before it is ingested into an LLM context.
 *
 * Extend PATTERNS as new attack surfaces are discovered.
 */

export interface ScanResult {
  clean: boolean;
  findings: Finding[];
}

export interface Finding {
  pattern: string;
  description: string;
  matchedAt: number; // character index
  excerpt: string;
}

// Known prompt injection patterns
const PATTERNS: Array<{ regex: RegExp; description: string }> = [
  {
    regex: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
    description: "Classic override: ignore previous instructions",
  },
  {
    regex: /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
    description: "Classic override: disregard previous instructions",
  },
  {
    regex: /you\s+are\s+now\s+(a|an)\s+/gi,
    description: "Persona override attempt",
  },
  {
    regex: /system\s*:\s*you\s+/gi,
    description: "Fake system prompt injection",
  },
  {
    regex: /<\s*system\s*>/gi,
    description: "HTML-style system tag injection",
  },
  {
    regex: /\[INST\]|\[\/INST\]|\[SYS\]|\[\/SYS\]/g,
    description: "Llama/Mistral instruction tag injection",
  },
  {
    regex: /###\s*instruction/gi,
    description: "Instruction block injection attempt",
  },
  {
    regex: /send\s+(your|the)\s+(private\s+key|secret\s+key|keypair)/gi,
    description: "Private key exfiltration attempt",
  },
  {
    regex: /transfer\s+all\s+(sol|tokens?|funds?)/gi,
    description: "Drain wallet command injection",
  },
  {
    regex: /\u200b|\u200c|\u200d|\ufeff|\u00ad/g,
    description: "Invisible unicode characters (potential steganographic injection)",
  },
  {
    regex: /<!--[\s\S]*?-->/g,
    description: "HTML comment (potential hidden instruction)",
  },
  {
    regex: /\bbase64\b.*\bdecode\b/gi,
    description: "Base64 decode instruction (potential obfuscated payload)",
  },
];

/**
 * Scan a string for prompt injection patterns.
 * Returns { clean: true } if no patterns found.
 * Returns { clean: false, findings } if suspicious content found.
 */
export function scanPromptInjection(text: string, source?: string): ScanResult {
  const findings: Finding[] = [];

  for (const { regex, description } of PATTERNS) {
    // Reset regex state (global flag)
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 20);
      const end = Math.min(text.length, match.index + match[0].length + 20);
      const excerpt = `...${text.slice(start, end)}...`;

      findings.push({
        pattern: regex.source,
        description,
        matchedAt: match.index,
        excerpt,
      });
    }
  }

  if (findings.length > 0 && source) {
    console.warn(`[SCAN] Prompt injection findings in source: ${source}`);
    for (const f of findings) {
      console.warn(`  ⚠ ${f.description}`);
    }
  }

  return {
    clean: findings.length === 0,
    findings,
  };
}
