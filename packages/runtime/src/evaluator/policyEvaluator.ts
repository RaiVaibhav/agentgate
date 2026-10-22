import type { AgentGateContract, Operator, ViolationAction } from '@agentgate/contract';
import type { StatefulLedger } from '../ledger/statefulLedger';

export interface EvaluationContext {
  principalId: string;
  sessionId: string;
  [key: string]: any;
}

export interface EvaluationRequest {
  callId: string;
  toolName: string;
  args: Record<string, any>;
  context: EvaluationContext;
}

export interface EvaluationResult {
  verdict: ViolationAction;
  allowed: boolean;
  reason?: string;
  source?: string;
  callId: string;
}

function evaluateOp(actual: any, op: Operator, expected: any): boolean {
  switch (op) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'gt':
      return Number(actual) > Number(expected);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'lte_field':
      return Number(actual) <= Number(expected);
    case 'gte_field':
      return Number(actual) >= Number(expected);
    case 'eq_field':
      return actual === expected;
    default:
      return false;
  }
}

export class PolicyEvaluator {
  constructor(
    private contract: AgentGateContract,
    private ledger: StatefulLedger
  ) {}

  /**
   * Deterministically evaluate a tool call against the compiled contract.
   * Runs in sub-millisecond time with zero external LLM calls.
   */
  async evaluate(req: EvaluationRequest): Promise<EvaluationResult> {
    const toolContract = this.contract.tools[req.toolName];
    if (!toolContract) {
      return { verdict: 'ALLOW', allowed: true, callId: req.callId };
    }

    const entityId = req.args['orderId'] || req.args['subscriptionId'] || req.args['id'];

    // 1. Ownership Binding Check
    if (toolContract.ownership) {
      const { lookupTool, matchArg, ownerField, equalsContext } = toolContract.ownership;
      const targetEntityId = req.args[matchArg];
      const lookupOutput = this.ledger.getToolOutput(targetEntityId, lookupTool);

      if (!lookupOutput) {
        return {
          verdict: 'BLOCK',
          allowed: false,
          reason: `Missing prerequisite: lookup tool '${lookupTool}' must be executed before '${req.toolName}'`,
          callId: req.callId,
        };
      }

      const entityOwner = lookupOutput[ownerField];
      const authUser = req.context[equalsContext];

      if (entityOwner !== authUser) {
        return {
          verdict: 'BLOCK',
          allowed: false,
          reason: `Ownership violation: ${matchArg} '${targetEntityId}' belongs to '${entityOwner}', not authenticated user '${authUser}'`,
          callId: req.callId,
        };
      }
    }

    // 2. Mutual Exclusion / Anti-Stacking Check
    if (toolContract.mutualExclusion && entityId) {
      const { conflictingTools, scopeKey, onViolation, source } = toolContract.mutualExclusion;
      const conflict = this.ledger.hasConflictingTool(entityId, conflictingTools);
      if (conflict.hasConflict) {
        return {
          verdict: onViolation,
          allowed: false,
          reason: `Anti-stacking violation: Conflicting tool '${conflict.conflictingTool}' already executed for ${scopeKey} '${entityId}'`,
          source,
          callId: req.callId,
        };
      }
    }

    // 3. Preconditions Check
    if (toolContract.preconditions && toolContract.preconditions.length > 0) {
      for (const rule of toolContract.preconditions) {
        // WhenArg conditional rule
        if (rule.whenArg) {
          const argVal = req.args[rule.whenArg.field];
          if (!evaluateOp(argVal, rule.whenArg.op, rule.whenArg.value)) {
            // Rule does not apply to this request
            continue;
          }
        }

        // Required prior tool verification
        if (rule.requirePriorTool) {
          const matchVal = req.args[rule.matchArg || 'orderId'];
          const priorOutput = this.ledger.getToolOutput(matchVal, rule.requirePriorTool);

          if (!priorOutput || !evaluateOp(priorOutput[rule.outputField || 'verified'], rule.op, rule.value)) {
            return {
              verdict: rule.onViolation,
              allowed: false,
              reason: `Prerequisite failed: ${rule.requirePriorTool} must be executed with ${rule.outputField}=${rule.value}`,
              source: rule.source,
              callId: req.callId,
            };
          }
          continue;
        }

        // Lookup tool field check
        if (rule.lookupTool) {
          const matchVal = entityId;
          const lookupOutput = this.ledger.getToolOutput(matchVal, rule.lookupTool);

          if (!lookupOutput) {
            return {
              verdict: rule.onViolation,
              allowed: false,
              reason: `Prerequisite failed: ${rule.lookupTool} must be executed before '${req.toolName}'`,
              source: rule.source,
              callId: req.callId,
            };
          }

          if (rule.op === 'lte_field' || rule.op === 'gte_field' || rule.op === 'eq_field') {
            const argVal = req.args[rule.argField || 'amount_cents'];
            const targetVal = lookupOutput[rule.targetField || 'totalPaid_cents'];
            if (!evaluateOp(argVal, rule.op, targetVal)) {
              return {
                verdict: rule.onViolation,
                allowed: false,
                reason: `Precondition failed: ${rule.argField} (${argVal}) exceeds target ${rule.targetField} (${targetVal})`,
                source: rule.source,
                callId: req.callId,
              };
            }
          } else if (rule.field) {
            const actualVal = lookupOutput[rule.field];
            if (!evaluateOp(actualVal, rule.op, rule.value)) {
              return {
                verdict: rule.onViolation,
                allowed: false,
                reason: `Precondition failed: ${rule.field} was '${actualVal}', required ${rule.op} '${rule.value}'`,
                source: rule.source,
                callId: req.callId,
              };
            }
          }
        }
      }
    }

    // 4. Threshold & Escalation Check
    if (toolContract.thresholds && toolContract.thresholds.length > 0) {
      for (const t of toolContract.thresholds) {
        const val = req.args[t.argField];
        if (val !== undefined && !evaluateOp(val, t.op, t.value)) {
          return {
            verdict: t.onViolation,
            allowed: false,
            reason: `Threshold exceeded: ${t.argField} (${val}) exceeds threshold of ${t.value} (requires escalation)`,
            source: t.source,
            callId: req.callId,
          };
        }
      }
    }

    // 5. Two-Phase Rolling Budget Check & Reservation
    if (toolContract.budget) {
      const { argField, maxTotal, windowSeconds, onViolation, source } = toolContract.budget;
      const amount = req.args[argField] || 0;

      const res = this.ledger.checkAndReserve({
        callId: req.callId,
        principalId: req.context.principalId,
        toolName: req.toolName,
        amount,
        entityId,
        maxBudget: maxTotal,
        windowSeconds,
      });

      if (!res.reserved) {
        return {
          verdict: onViolation,
          allowed: false,
          reason: `Budget cap exceeded: Total across window would be ${res.currentTotal + amount}, exceeding max budget of ${maxTotal}`,
          source,
          callId: req.callId,
        };
      }
    }

    return {
      verdict: 'ALLOW',
      allowed: true,
      callId: req.callId,
    };
  }
}
