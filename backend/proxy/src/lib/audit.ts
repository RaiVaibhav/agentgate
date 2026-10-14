import crypto from 'crypto';
import { db } from '../db/drizzle.js';
import { auditLog } from '../db/schema.js';
import { eq, desc, asc } from 'drizzle-orm';

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
 * Verify cryptographic integrity of the audit log chain.
 * Returns valid=true only if zero records have been altered, injected, or deleted.
 */
export async function verifyAuditChain(sessionId?: string): Promise<{
  valid: boolean;
  totalEntries: number;
  verifiedCount: number;
  brokenEntryId?: string;
  error?: string;
}> {
  const query = sessionId
    ? db.select().from(auditLog).where(eq(auditLog.sessionId, sessionId)).orderBy(asc(auditLog.timestamp), asc(auditLog.id))
    : db.select().from(auditLog).orderBy(asc(auditLog.timestamp), asc(auditLog.id));


  const entries = await query;
  let expectedPrevHash = 'GENESIS';
  let verifiedCount = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.entryHash) {
      continue; // skip pre-chaining legacy records
    }

    if (entry.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        verifiedCount,
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
        verifiedCount,
        brokenEntryId: entry.id,
        error: `Tampered content at entry ${entry.id}: computed hash ${recomputed} does not match stored ${entry.entryHash}`,
      };
    }

    expectedPrevHash = entry.entryHash;
    verifiedCount++;
  }

  return {
    valid: true,
    totalEntries: entries.length,
    verifiedCount,
  };
}
