import { Router } from 'express';
import { db } from '../db/drizzle.js';
import { sessions, agents, services, toolPermissions } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { signSessionToken } from '../lib/jwt.js';

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): number | null {
  const raw = req.headers['x-user-id'];
  if (!raw || Array.isArray(raw)) return null;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

// POST /sessions — create a session with per-session permissions
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { agentId, serviceId, durationMinutes = 60, permissions, responseCheckEnabled = false } = req.body as {
    agentId?: string;
    serviceId?: string;
    durationMinutes?: number;
    responseCheckEnabled?: boolean;
    permissions?: Array<{
      toolName: string;
      effect: 'allow' | 'deny';
      pathArg?: string;
      pathPattern?: string;
      priority?: number;
    }>;
  };

  if (!agentId || !serviceId) {
    res.status(400).json({ error: 'agentId and serviceId are required' }); return;
  }

  // Verify agent belongs to user
  const [agent] = await db.select().from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId))).limit(1);
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

  // Verify service belongs to agent
  const [service] = await db.select().from(services)
    .where(and(eq(services.id, serviceId), eq(services.agentId, agentId))).limit(1);
  if (!service) { res.status(404).json({ error: 'Service not found' }); return; }

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const [session] = await db.insert(sessions).values({
    agentId,
    serviceId,
    token: 'pending',
    expiresAt,
    status: 'active',
    responseCheckEnabled: responseCheckEnabled ? 'true' : 'false',
  }).returning();

  const token = await signSessionToken({ sessionId: session.id, agentId }, expiresAt);

  const [updated] = await db.update(sessions)
    .set({ token })
    .where(eq(sessions.id, session.id))
    .returning();

  // Insert tool permissions for this session
  if (permissions && permissions.length > 0) {
    await db.insert(toolPermissions).values(
      permissions.map((p) => ({
        sessionId: session.id,
        toolName: p.toolName,
        effect: p.effect,
        pathArg: p.pathArg ?? null,
        pathPattern: p.pathPattern ?? null,
        priority: p.priority ?? 1,
      }))
    );
  }

  const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3003';

  res.status(201).json({
    sessionId: updated.id,
    agentId: updated.agentId,
    serviceId: updated.serviceId,
    token,
    expiresAt: updated.expiresAt,
    status: updated.status,
    gatewayUrl: `${GATEWAY_URL}/mcp/${token}`,
  });
});

// GET /sessions
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const userAgents = await db.select({ id: agents.id }).from(agents).where(eq(agents.userId, userId));
  const userAgentIds = userAgents.map((a) => a.id);
  if (userAgentIds.length === 0) { res.json([]); return; }

  const all = await db.select().from(sessions).where(inArray(sessions.agentId, userAgentIds));
  res.json(all);
});

// GET /sessions/:id
router.get('/:id', async (req, res) => {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, req.params.id)).limit(1);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  
  const perms = await db.select().from(toolPermissions).where(eq(toolPermissions.sessionId, session.id));
  res.json({ ...session, permissions: perms });
});

// POST /sessions/:id/revoke
router.post('/:id/revoke', async (req, res) => {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, req.params.id)).limit(1);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const [updated] = await db.update(sessions).set({ status: 'revoked' })
    .where(eq(sessions.id, req.params.id)).returning();
  res.json({ message: 'Session revoked', session: updated });
});

// PATCH /sessions/:id/permissions — update permissions for an active session
router.patch('/:id/permissions', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const [session] = await db.select().from(sessions).where(eq(sessions.id, req.params.id)).limit(1);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (session.status !== 'active') { res.status(400).json({ error: 'Can only update active sessions' }); return; }

  // Verify ownership
  const [agent] = await db.select().from(agents)
    .where(and(eq(agents.id, session.agentId), eq(agents.userId, userId))).limit(1);
  if (!agent) { res.status(404).json({ error: 'Not authorized' }); return; }

  const { permissions } = req.body as {
    permissions: Array<{
      toolName: string;
      effect: 'allow' | 'deny';
      pathArg?: string;
      pathPattern?: string;
      priority?: number;
    }>;
  };

  // Replace all permissions for this session
  await db.delete(toolPermissions).where(eq(toolPermissions.sessionId, session.id));

  if (permissions?.length > 0) {
    await db.insert(toolPermissions).values(
      permissions.map((p) => ({
        sessionId: session.id,
        toolName: p.toolName,
        effect: p.effect,
        pathArg: p.pathArg ?? null,
        pathPattern: p.pathPattern ?? null,
        priority: p.priority ?? 1,
      }))
    );
  }

  const updated = await db.select().from(toolPermissions).where(eq(toolPermissions.sessionId, session.id));
  res.json(updated);
});

export default router;
