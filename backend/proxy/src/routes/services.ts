import { Router } from 'express';
import { db } from '../db/drizzle.js';
import { services, agents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { NewService } from '../db/schema.js';
import { encryptObject, maskObject } from '../lib/crypto.js';

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): number | null {
  const raw = req.headers['x-user-id'];
  if (!raw || Array.isArray(raw)) return null;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

async function verifyAgentOwnership(agentId: string, userId: number): Promise<boolean> {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)))
    .limit(1);
  return !!agent;
}

function sanitizeService(service: typeof services.$inferSelect) {
  return {
    ...service,
    headers: maskObject((service.headers as Record<string, any>) ?? {}),
    env: maskObject((service.env as Record<string, any>) ?? {}),
  };
}

// GET /services?agentId=xxx
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { agentId } = req.query as { agentId?: string };
  if (!agentId) { res.status(400).json({ error: 'agentId is required' }); return; }

  if (!await verifyAgentOwnership(agentId, userId)) {
    res.status(404).json({ error: 'Agent not found' }); return;
  }

  const all = await db
    .select()
    .from(services)
    .where(eq(services.agentId, agentId));

  res.json(all.map(sanitizeService));
});

// POST /services — create service
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  let { agentId, name, command, args, env, url, headers, tools } = req.body as {
    agentId?: string;
    name?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    tools?: unknown[];
    servers?: Record<string, any>;
  };

  // Support nested mcp.json format: { servers: { name: { url, headers } } }
  if (!command && !url && req.body.servers) {
    const first = Object.values(req.body.servers)[0] as any;
    if (first) {
      url = first.url;
      headers = first.headers ?? {};
      command = first.command;
      args = first.args ?? [];
      env = first.env ?? {};
    }
  }

  if (!agentId || !name || (!command && !url)) {
    console.log('[services] Validation failed:', { agentId, name, command, url, hasServers: !!req.body.servers });
    res.status(400).json({ error: 'agentId, name, and either command or url are required' }); return;
  }

  if (!await verifyAgentOwnership(agentId, userId)) {
    res.status(404).json({ error: 'Agent not found' }); return;
  }

  // Encrypt sensitive headers and env values before storing at rest
  const secureHeaders = encryptObject(headers ?? {});
  const secureEnv = encryptObject(env ?? {});

  const [service] = await db
    .insert(services)
    .values({
      agentId,
      name,
      command: command ?? null,
      args: args ?? [],
      env: secureEnv,
      url: url ?? null,
      headers: secureHeaders,
      tools: tools ?? [],
    })
    .returning();

  res.status(201).json(sanitizeService(service));
});

// GET /services/:id
router.get('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const [service] = await db.select().from(services).where(eq(services.id, req.params.id)).limit(1);
  if (!service) { res.status(404).json({ error: 'Service not found' }); return; }
  if (!await verifyAgentOwnership(service.agentId, userId)) {
    res.status(404).json({ error: 'Service not found' }); return;
  }

  res.json(sanitizeService(service));
});

// DELETE /services/:id
router.delete('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, req.params.id))
    .limit(1);

  if (!service) { res.status(204).send(); return; }
  if (!await verifyAgentOwnership(service.agentId, userId)) {
    res.status(404).json({ error: 'Service not found' }); return;
  }

  await db.delete(services).where(eq(services.id, req.params.id));
  res.status(204).send();
});

export default router;
