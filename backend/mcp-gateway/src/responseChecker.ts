/**
 * Response Checker — scans MCP tool responses for security issues.
 *
 * Checks for:
 *   1. Secret patterns (API keys, tokens, private keys)
 *   2. Prompt injection attempts (instructions hidden in data)
 *   3. PII patterns (emails in bulk, SSNs, credit cards)
 *   4. Excessive data size
 *
 * This is a built-in regex-based scanner. Phase 2 would add an
 * external service (LLM Guard, etc.) for ML-based detection.
 */

export type ScanResult = {
  safe: boolean;
  issues: ScanIssue[];
};

export type ScanIssue = {
  type: 'secret' | 'prompt_injection' | 'pii' | 'size_exceeded';
  description: string;
  match?: string;  // redacted sample of what was found
};

// ── Secret patterns ───────────────────────────────────────────────────────────

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'AWS Access Key',        regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret Key',        regex: /[0-9a-zA-Z/+=]{40}(?=\s|$)/ },
  { name: 'Stripe Secret Key',     regex: /sk_(live|test)_[0-9a-zA-Z]{20,}/ },
  { name: 'Stripe Restricted Key', regex: /rk_(live|test)_[0-9a-zA-Z]{20,}/ },
  { name: 'GitHub Token',          regex: /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/ },
  { name: 'GitHub PAT (fine)',      regex: /github_pat_[A-Za-z0-9_]{22,}/ },
  { name: 'Private Key',           regex: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/ },
  { name: 'Generic API Key',       regex: /['\"][a-zA-Z0-9_\-]{20,}['\"]\s*[=:]\s*['\"][a-zA-Z0-9_\-\/+=]{20,}['\"]/  },
  { name: 'Bearer Token',          regex: /Bearer\s+[a-zA-Z0-9\-._~+\/]+=*/ },
  { name: 'Database URL',          regex: /(?:postgres|mysql|mongodb):\/\/[^\s'"]+:[^\s'"]+@/ },
];

// ── Prompt injection patterns ─────────────────────────────────────────────────

const INJECTION_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'Ignore instructions',   regex: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts)/i },
  { name: 'System prompt leak',    regex: /repeat\s+(your|the)\s+(system\s+)?prompt/i },
  { name: 'Role override',         regex: /you\s+are\s+now\s+(a|an|the)\s+/i },
  { name: 'Jailbreak attempt',     regex: /DAN|do anything now|developer mode/i },
  { name: 'Instruction injection', regex: /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i },
  { name: 'Tool call injection',   regex: /tools\/call|function_call|execute.*command/i },
];

// ── PII patterns ──────────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ name: string; regex: RegExp; threshold: number }> = [
  { name: 'Email addresses',  regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, threshold: 5 },
  { name: 'SSN',              regex: /\b\d{3}-\d{2}-\d{4}\b/g, threshold: 1 },
  { name: 'Credit card',      regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g, threshold: 1 },
  { name: 'Phone numbers',    regex: /\b\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, threshold: 10 },
];

// ── Size limits ───────────────────────────────────────────────────────────────

const MAX_RESPONSE_SIZE = 100_000; // 100KB

// ── Scanner ───────────────────────────────────────────────────────────────────

export function scanResponse(content: string): ScanResult {
  const issues: ScanIssue[] = [];

  // Check size
  if (content.length > MAX_RESPONSE_SIZE) {
    issues.push({
      type: 'size_exceeded',
      description: `Response is ${Math.round(content.length / 1024)}KB — exceeds ${MAX_RESPONSE_SIZE / 1024}KB limit`,
    });
  }

  // Check secrets
  for (const pattern of SECRET_PATTERNS) {
    const match = content.match(pattern.regex);
    if (match) {
      issues.push({
        type: 'secret',
        description: `Found ${pattern.name}`,
        match: match[0].slice(0, 8) + '***',
      });
    }
  }

  // Check prompt injection
  for (const pattern of INJECTION_PATTERNS) {
    const match = content.match(pattern.regex);
    if (match) {
      issues.push({
        type: 'prompt_injection',
        description: `Potential prompt injection: ${pattern.name}`,
        match: match[0].slice(0, 30),
      });
    }
  }

  // Check PII (only flag if above threshold)
  for (const pattern of PII_PATTERNS) {
    const matches = content.match(pattern.regex) ?? [];
    if (matches.length >= pattern.threshold) {
      issues.push({
        type: 'pii',
        description: `Found ${matches.length} ${pattern.name} (threshold: ${pattern.threshold})`,
      });
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}

/**
 * Extract text content from an MCP tool result for scanning.
 */
export function extractTextFromResult(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const r = result as Record<string, unknown>;
  
  // MCP result format: { content: [{ type: "text", text: "..." }] }
  if (Array.isArray(r.content)) {
    return r.content
      .filter((c: any) => c.type === 'text' && typeof c.text === 'string')
      .map((c: any) => c.text)
      .join('\n');
  }

  // Fallback: stringify
  return JSON.stringify(result);
}
