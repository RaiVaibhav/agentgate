import micromatch from 'micromatch';
import type { Rule, Decision } from './types.js';

/**
 * Pure decision function — no I/O, no network, no DB.
 *
 * Algorithm:
 *   1. Sort rules by priority DESC
 *   2. Find first rule where pattern matches path AND action matches
 *   3. No match → deny (fail-closed)
 *   4. Match → apply effect
 */
export function decide(
  rules: Rule[],
  resourcePath: string,
  action: string
): Decision {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    const actionMatches =
      rule.action === 'any' || rule.action === action;

    const pathMatches = micromatch.isMatch(resourcePath, rule.pattern, {
      dot: true,       // match dotfiles like .env
      nocase: false,
    });

    if (actionMatches && pathMatches) {
      return {
        effect: rule.effect === 'allow' ? 'allowed' : 'denied',
        reason: `Matched ${rule.effect} rule (priority ${rule.priority}): "${rule.pattern}"${rule.comment ? ` — ${rule.comment}` : ''}`,
        rule,
      };
    }
  }

  return {
    effect: 'denied',
    reason: 'No matching rule — denied by default (fail-closed)',
    rule: null,
  };
}
