import micromatch from 'micromatch';
import type { ToolPermission, ParamRule } from './db/schema.js';

export type Decision = {
  effect: 'allowed' | 'denied' | 'requires_approval';
  reason: string;
  matchedPermissionId: string | null;
  ruleExplanation?: string;
};

/**
 * Evaluates a single ParamRule against tool arguments.
 */
export function evaluateParamRule(rule: ParamRule, toolArgs: Record<string, unknown>): boolean {
  const argValue = toolArgs[rule.field];

  switch (rule.operator) {
    case 'eq':
      return argValue === rule.value;
    case 'neq':
      return argValue !== rule.value;
    case 'gt':
      return typeof argValue === 'number' && typeof rule.value === 'number'
        ? argValue > rule.value
        : Number(argValue) > Number(rule.value);
    case 'gte':
      return typeof argValue === 'number' && typeof rule.value === 'number'
        ? argValue >= rule.value
        : Number(argValue) >= Number(rule.value);
    case 'lt':
      return typeof argValue === 'number' && typeof rule.value === 'number'
        ? argValue < rule.value
        : Number(argValue) < Number(rule.value);
    case 'lte':
      return typeof argValue === 'number' && typeof rule.value === 'number'
        ? argValue <= rule.value
        : Number(argValue) <= Number(rule.value);
    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(argValue);
    case 'not_in':
      return Array.isArray(rule.value) && !rule.value.includes(argValue);
    case 'regex': {
      try {
        const re = new RegExp(String(rule.value), 'i');
        return re.test(String(argValue ?? ''));
      } catch {
        return false;
      }
    }
    case 'regex_not_match': {
      try {
        const re = new RegExp(String(rule.value), 'i');
        return !re.test(String(argValue ?? ''));
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/**
 * Decide whether a tool call is allowed.
 *
 * Algorithm:
 *   1. Find all permissions for this tool name
 *   2. Sort by priority DESC
 *   3. If pathArg set — check pathPattern against the arg value
 *   4. If paramRules set — check that all paramRules match (AND logic)
 *   5. First match wins
 *   6. No match → denied by default (fail-closed)
 */
export function decide(
  permissions: ToolPermission[],
  toolName: string,
  toolArgs: Record<string, unknown>
): Decision {
  const relevant = permissions
    .filter((p) => p.toolName === toolName)
    .sort((a, b) => b.priority - a.priority);

  for (const perm of relevant) {
    // 1. Path pattern check
    if (perm.pathArg && perm.pathPattern) {
      const argValue = String(toolArgs[perm.pathArg] ?? '');
      const matches = micromatch.isMatch(argValue, perm.pathPattern, { dot: true });
      if (!matches) continue; // pattern didn't match, try next permission
    }

    // 2. Parameter-aware rules check
    if (perm.paramRules && Array.isArray(perm.paramRules) && perm.paramRules.length > 0) {
      const rules = perm.paramRules as ParamRule[];
      const allRulesMatch = rules.every((rule) => evaluateParamRule(rule, toolArgs));
      if (!allRulesMatch) continue; // param conditions not met, try next permission
    }

    // This permission matches
    let effect: 'allowed' | 'denied' | 'requires_approval';
    if (perm.effect === 'allow' || perm.effect === 'allowed') {
      effect = 'allowed';
    } else if (perm.effect === 'require_approval' || perm.effect === 'approval') {
      effect = 'requires_approval';
    } else {
      effect = 'denied';
    }

    const patternNote = perm.pathPattern ? ` (path: "${perm.pathPattern}")` : '';
    const rulesNote = perm.paramRules && Array.isArray(perm.paramRules) && perm.paramRules.length > 0
      ? ` (params: ${JSON.stringify(perm.paramRules)})`
      : '';

    return {
      effect,
      reason: `Matched ${perm.effect} permission (priority ${perm.priority})${patternNote}${rulesNote}`,
      matchedPermissionId: perm.id,
    };
  }

  // Fail-closed: default-deny
  return {
    effect: 'denied',
    reason: `No explicit permission for tool "${toolName}" with given arguments — denied by default (fail-closed)`,
    matchedPermissionId: null,
  };
}

