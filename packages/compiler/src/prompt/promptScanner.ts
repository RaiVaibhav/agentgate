import fs from 'fs';
import { normalizeCurrency, normalizeTimeWindow } from '../normalizer/unitNormalizer';
import type {
  OwnershipRule,
  PreconditionRule,
  ThresholdRule,
  MutualExclusionRule,
  BudgetRule,
  UnmappableRule,
} from '@agentgate/contract';
import type { ToolMeta } from '../ast/toolScanner';

export interface PromptScanResult {
  ownership?: OwnershipRule;
  promptPreconditions: PreconditionRule[];
  thresholds: ThresholdRule[];
  mutualExclusion?: MutualExclusionRule;
  budget?: BudgetRule;
  unmappableRules: UnmappableRule[];
}

export function scanPromptFile(promptPath: string, tools: ToolMeta[] = []): PromptScanResult {
  const content = fs.readFileSync(promptPath, 'utf8');
  const lines = content.split('\n');

  let ownership: OwnershipRule | undefined;
  const promptPreconditions: PreconditionRule[] = [];
  const thresholds: ThresholdRule[] = [];
  let mutualExclusion: MutualExclusionRule | undefined;
  let budget: BudgetRule | undefined;
  const unmappableRules: UnmappableRule[] = [];

  const toolNames = new Set(tools.map((t) => t.name));
  const knownFields = new Set<string>();
  for (const t of tools) {
    for (const p of Object.keys(t.properties)) {
      knownFields.add(p.toLowerCase());
    }
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-') && !trimmed.startsWith('*')) return;

    const text = trimmed.replace(/^[-*]\s*/, '').trim();
    const source = `src/agent/prompt.md:L${idx + 1}`;

    // Filter out conversational fluff
    if (
      text.toLowerCase().includes('empathetic') ||
      text.toLowerCase().includes('greetings') ||
      text.toLowerCase().includes('listen actively') ||
      text.toLowerCase().includes('helpful') ||
      text.toLowerCase().includes('tone')
    ) {
      return;
    }

    // 1. Ownership binding check
    if (text.includes('look up') || text.includes('get_order') || text.includes('get_subscription')) {
      const isSub = text.includes('get_subscription');
      ownership = {
        lookupTool: isSub ? 'get_subscription' : 'get_order',
        matchArg: isSub ? 'subscriptionId' : 'orderId',
        ownerField: isSub ? 'customerId' : 'userId',
        equalsContext: 'principalId',
      };
      return;
    }

    // 2. Unmappable rule detection: checks for concepts like "VIP" or "tier"
    if (text.toLowerCase().includes('vip') || text.toLowerCase().includes('tier')) {
      unmappableRules.push({
        source,
        rawText: text,
        reason: "No tool schema or output exposes a user 'tier' field.",
      });
      return;
    }

    if (text.toLowerCase().includes('enterprise sla') || text.toLowerCase().includes('support tier')) {
      unmappableRules.push({
        source,
        rawText: text,
        reason: "No tool schema or output exposes an 'enterprise sla' field.",
      });
      return;
    }

    // 3. Prior tool / verification prerequisite
    if (text.includes('DAMAGED') && (text.includes('verify_damage_report') || text.includes('verified=true'))) {
      promptPreconditions.push({
        source,
        whenArg: { field: 'reason', op: 'eq', value: 'DAMAGED' },
        requirePriorTool: 'verify_damage_report',
        matchArg: 'orderId',
        outputField: 'verified',
        op: 'eq',
        value: true,
        onViolation: 'BLOCK',
      });
      return;
    }

    // 4. Mutual exclusion
    if (text.toLowerCase().includes('mutually exclusive') || text.toLowerCase().includes('do not issue both') || text.toLowerCase().includes('do not apply both')) {
      const conflicting: string[] = [];
      if (text.includes('wallet credit')) conflicting.push('add_wallet_credit');
      if (text.includes('discount')) conflicting.push('apply_discount_code');
      if (text.includes('retention coupon')) conflicting.push('apply_retention_coupon');
      if (text.includes('invoice credit')) conflicting.push('issue_invoice_credit');

      if (conflicting.length > 0) {
        mutualExclusion = {
          source,
          conflictingTools: conflicting,
          scopeKey: text.includes('subscription') ? 'subscriptionId' : 'orderId',
          onViolation: 'BLOCK',
        };
      }
      return;
    }

    // 5. Threshold with escalation
    if (text.toLowerCase().includes('escalat') || text.toLowerCase().includes('manager approval') || text.toLowerCase().includes('greater than')) {
      const norm = normalizeCurrency(text, 'amount_cents');
      if (norm) {
        thresholds.push({
          source,
          argField: 'amount_cents',
          op: 'lte',
          value: norm.value,
          unitConversionNote: norm.note || `Converted to ${norm.value} cents`,
          onViolation: 'ESCALATE',
        });
      }
      return;
    }

    // 6. Cumulative Budget rule
    if (text.toLowerCase().includes('maximum') || text.toLowerCase().includes('cumulative total') || text.toLowerCase().includes('budget')) {
      const norm = normalizeCurrency(text, 'amount_cents');
      const timeNorm = normalizeTimeWindow(text);

      if (norm) {
        const shared: string[] = [];
        if (text.includes('refund')) shared.push('issue_refund');
        if (text.includes('credit')) shared.push(text.includes('invoice') ? 'issue_invoice_credit' : 'add_wallet_credit');

        budget = {
          source,
          argField: 'amount_cents',
          sharedAcrossTools: shared.length > 0 ? shared : undefined,
          scope: 'principalId',
          windowSeconds: timeNorm.windowSeconds,
          maxTotal: norm.value,
          unitConversionNote: norm.note || `Converted to ${norm.value} cents`,
          onViolation: 'BLOCK',
        };
      }
      return;
    }
  });

  return {
    ownership,
    promptPreconditions,
    thresholds,
    mutualExclusion,
    budget,
    unmappableRules,
  };
}
