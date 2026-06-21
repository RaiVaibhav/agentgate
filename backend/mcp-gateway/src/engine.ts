import micromatch from 'micromatch';
import type { ToolPermission } from './db/schema.js';

export type Decision = {
  effect: 'allowed' | 'denied';
  reason: string;
  matchedPermissionId: string | null;
};

/**
 * Decide whether a tool call is allowed.
 *
 * Algorithm:
 *   1. Find all permissions for this tool name
 *   2. Sort by priority DESC
 *   3. If pathArg set — check pathPattern against the arg value
 *   4. First match wins
 *   5. No match → denied by default (fail-closed)
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
    // If this permission has a path pattern, check it
    if (perm.pathArg && perm.pathPattern) {
      const argValue = String(toolArgs[perm.pathArg] ?? '');
      const matches = micromatch.isMatch(argValue, perm.pathPattern, { dot: true });
      if (!matches) continue; // pattern didn't match, try next permission
    }

    // This permission matches
    const effect = perm.effect === 'allow' ? 'allowed' : 'denied';
    const patternNote = perm.pathPattern ? ` (path: "${perm.pathPattern}")` : '';
    return {
      effect,
      reason: `Matched ${perm.effect} permission (priority ${perm.priority})${patternNote}`,
      matchedPermissionId: perm.id,
    };
  }

  return {
    effect: 'allowed',
    reason: `No explicit permission for tool "${toolName}" — allowed by default`,
    matchedPermissionId: null,
  };
}
