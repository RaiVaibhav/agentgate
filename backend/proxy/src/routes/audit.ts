import { Router } from 'express';
import { db } from '../db/drizzle.js';
import { auditLog, agents } from '../db/schema.js';
import { eq, desc, and, inArray } from 'drizzle-orm';

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): number | null {
  const raw = req.headers['x-user-id'];
  if (!raw || Array.isArray(raw)) return null;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

// GET /audit — query audit log scoped to this user's agents
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { agentId, sessionId, effect, limit = '50' } = req.query as Record<string, string>;

  const userAgents = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.userId, userId));
  const userAgentIds = userAgents.map((a) => a.id);
  if (userAgentIds.length === 0) { res.json([]); return; }

  const conditions = [inArray(auditLog.agentId, userAgentIds)];
  if (agentId) conditions.push(eq(auditLog.agentId, agentId));
  if (sessionId) conditions.push(eq(auditLog.sessionId, sessionId));
  if (effect) conditions.push(eq(auditLog.effect, effect));

  const entries = await db
    .select({
      id: auditLog.id,
      sessionId: auditLog.sessionId,
      agentId: auditLog.agentId,
      serviceId: auditLog.serviceId,
      toolName: auditLog.toolName,
      toolArgs: auditLog.toolArgs,
      effect: auditLog.effect,
      reason: auditLog.reason,
      matchedPermissionId: auditLog.matchedPermissionId,
      timestamp: auditLog.timestamp,
    })
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.timestamp))
    .limit(parseInt(limit, 10));

  res.json(entries);
});

export default router;
