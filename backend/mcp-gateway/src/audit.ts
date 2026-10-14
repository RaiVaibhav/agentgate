import crypto from 'crypto';
import { db } from './db/drizzle.js';
import { auditLog } from './db/schema.js';
import { eq, desc, asc } from 'drizzle-orm';

/**
 * Deterministic JSON stringifier to ensure consistent cryptographic hashing
 */
function canonicalStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map(k => `"${k}":${canonicalStringify((obj as Record<string, unknown>)[k])}`).join(',') + '}';
}

export function computeEntryHash(params: {
  prevHash: string;
  sessionId: string | null;
  agentId: string;
  serviceId: string | null;
  toolName: string;
  toolArgs: unknown;
  effect: string;
  reason: string;
  matchedPermissionId: string | null;
  simulatedEffect?: string | null;
  timestamp: Date;
}): string {
  const payload = [
    params.prevHash,
    params.sessionId ?? '',
    params.agentId,
    params.serviceId ?? '',
    params.toolName,
    canonicalStringify(params.toolArgs),
    params.effect,
    params.reason,
    params.matchedPermissionId ?? '',
    params.simulatedEffect ?? '',
    params.timestamp.toISOString(),
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Insert a tamper-evident, hash-chained audit log entry.
 */
export async function logAuditEvent(params: {
  sessionId?: string | null;
  agentId: string;
  serviceId?: string | null;
  toolName: string;
  toolArgs?: unknown;
  effect: string;
  reason: string;
  matchedPermissionId?: string | null;
  simulatedEffect?: string | null;
  latencyMs?: number | null;
}) {
  // 1. Find previous entry in the global audit chain
  let prevHash = 'GENESIS';

  const [latest] = await db
    .select({ entryHash: auditLog.entryHash })
    .from(auditLog)
    .orderBy(desc(auditLog.timestamp), desc(auditLog.id))
    .limit(1);

  if (latest?.entryHash) {
    prevHash = latest.entryHash;
  }


  const now = new Date();
  const entryHash = computeEntryHash({
    prevHash,
    sessionId: params.sessionId ?? null,
    agentId: params.agentId,
    serviceId: params.serviceId ?? null,
    toolName: params.toolName,
    toolArgs: params.toolArgs ?? {},
    effect: params.effect,
    reason: params.reason,
    matchedPermissionId: params.matchedPermissionId ?? null,
    simulatedEffect: params.simulatedEffect ?? null,
    timestamp: now,
  });

  const [inserted] = await db
    .insert(auditLog)
    .values({
      sessionId: params.sessionId ?? null,
      agentId: params.agentId,
      serviceId: params.serviceId ?? null,
      toolName: params.toolName,
      toolArgs: (params.toolArgs as Record<string, unknown>) ?? {},
      effect: params.effect,
      reason: params.reason,
      matchedPermissionId: params.matchedPermissionId ?? null,
      prevHash,
      entryHash,
      latencyMs: params.latencyMs ?? null,
      simulatedEffect: params.simulatedEffect ?? null,
      timestamp: now,
    })
    .returning();

  return inserted;
}

/**
 * Verify cryptographic integrity of the audit log chain.
 * Returns valid=true only if zero records have been altered, injected, or deleted.
 */
export async function verifyAuditChain(sessionId?: string): Promise<{
  valid: boolean;
  totalEntries: number;
  brokenEntryId?: string;
  error?: string;
}> {
  const query = sessionId
    ? db.select().from(auditLog).where(eq(auditLog.sessionId, sessionId)).orderBy(asc(auditLog.timestamp), asc(auditLog.id))
    : db.select().from(auditLog).orderBy(asc(auditLog.timestamp), asc(auditLog.id));


  const entries = await query;
  let expectedPrevHash = 'GENESIS';

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    // For legacy entries created before hash-chaining was enabled, skip or check if null
    if (!entry.entryHash) {
      continue;
    }

    if (entry.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenEntryId: entry.id,
        error: `Broken chain link at entry ${entry.id}: expected prevHash ${expectedPrevHash}, found ${entry.prevHash}`,
      };
    }

    const recomputed = computeEntryHash({
      prevHash: entry.prevHash,
      sessionId: entry.sessionId,
      agentId: entry.agentId,
      serviceId: entry.serviceId,
      toolName: entry.toolName,
      toolArgs: entry.toolArgs,
      effect: entry.effect,
      reason: entry.reason,
      matchedPermissionId: entry.matchedPermissionId,
      simulatedEffect: entry.simulatedEffect,
      timestamp: new Date(entry.timestamp),
    });

    if (recomputed !== entry.entryHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenEntryId: entry.id,
        error: `Tampered content at entry ${entry.id}: computed hash ${recomputed} does not match stored ${entry.entryHash}`,
      };
    }

    expectedPrevHash = entry.entryHash;
  }

  return {
    valid: true,
    totalEntries: entries.length,
  };
}
