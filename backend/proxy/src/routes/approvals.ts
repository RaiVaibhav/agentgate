import { Router } from 'express';
import { db } from '../db/drizzle.js';
import { approvals, agents, sessions, services } from '../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): number | null {
  const raw = req.headers['x-user-id'];
  if (!raw || Array.isArray(raw)) return null;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

// GET /approvals — list approvals for user's agents
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { agentId, status } = req.query as { agentId?: string; status?: string };

  const userAgents = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.userId, userId));

  const userAgentIds = userAgents.map((a) => a.id);
  if (userAgentIds.length === 0) { res.json([]); return; }

  let query = db
    .select({
      id: approvals.id,
      sessionId: approvals.sessionId,
      agentId: approvals.agentId,
      agentName: agents.name,
      serviceId: approvals.serviceId,
      serviceName: services.name,
      toolName: approvals.toolName,
      toolArgs: approvals.toolArgs,
      status: approvals.status,
      reason: approvals.reason,
      requestedAt: approvals.requestedAt,
      resolvedAt: approvals.resolvedAt,
      resolvedBy: approvals.resolvedBy,
      decisionNotes: approvals.decisionNotes,
    })
    .from(approvals)
    .innerJoin(agents, eq(approvals.agentId, agents.id))
    .innerJoin(services, eq(approvals.serviceId, services.id))
    .where(inArray(approvals.agentId, userAgentIds))
    .orderBy(desc(approvals.requestedAt));

  const list = await query;
  let filtered = list;
  if (agentId) {
    filtered = filtered.filter((a) => a.agentId === agentId);
  }
  if (status) {
    filtered = filtered.filter((a) => a.status === status);
  }

  res.json(filtered);
});

// GET /approvals/:id
router.get('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const [approval] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, req.params.id))
    .limit(1);

  if (!approval) { res.status(404).json({ error: 'Approval not found' }); return; }

  // Verify ownership
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, approval.agentId), eq(agents.userId, userId)))
    .limit(1);

  if (!agent) { res.status(403).json({ error: 'Unauthorized' }); return; }

  res.json(approval);
});

// POST /approvals/:id/approve
router.post('/:id/approve', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const [approval] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, req.params.id))
    .limit(1);

  if (!approval) { res.status(404).json({ error: 'Approval request not found' }); return; }

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, approval.agentId), eq(agents.userId, userId)))
    .limit(1);

  if (!agent) { res.status(403).json({ error: 'Unauthorized' }); return; }

  const notes = req.body?.notes ?? 'Approved by operator';

  const [updated] = await db
    .update(approvals)
    .set({
      status: 'approved',
      resolvedAt: new Date(),
      resolvedBy: userId,
      decisionNotes: notes,
    })
    .where(eq(approvals.id, req.params.id))
    .returning();

  res.json({ message: 'Action approved successfully', approval: updated });
});

// POST /approvals/:id/reject
router.post('/:id/reject', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const [approval] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, req.params.id))
    .limit(1);

  if (!approval) { res.status(404).json({ error: 'Approval request not found' }); return; }

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, approval.agentId), eq(agents.userId, userId)))
    .limit(1);

  if (!agent) { res.status(403).json({ error: 'Unauthorized' }); return; }

  const reason = req.body?.reason ?? 'Rejected by administrator';

  const [updated] = await db
    .update(approvals)
    .set({
      status: 'rejected',
      resolvedAt: new Date(),
      resolvedBy: userId,
      decisionNotes: reason,
    })
    .where(eq(approvals.id, req.params.id))
    .returning();

  res.json({ message: 'Action rejected successfully', approval: updated });
});

export default router;
