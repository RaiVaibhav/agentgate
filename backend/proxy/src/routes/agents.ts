import { Router } from 'express';
import { db } from '../db/drizzle.js';
import { agents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { NewAgent } from '../db/schema.js';

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): number | null {
  const raw = req.headers['x-user-id'];
  if (!raw || Array.isArray(raw)) return null;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

// GET /agents
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const all = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, userId))
    .orderBy(agents.createdAt);
  res.json(all);
});

// POST /agents
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { name, description } = req.body as Partial<NewAgent>;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }

  const [agent] = await db
    .insert(agents)
    .values({ userId, name, description })
    .returning();
  res.status(201).json(agent);
});

// GET /agents/:id
router.get('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, req.params.id), eq(agents.userId, userId)))
    .limit(1);

  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
  res.json(agent);
});

// DELETE /agents/:id
router.delete('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  await db
    .delete(agents)
    .where(and(eq(agents.id, req.params.id), eq(agents.userId, userId)));
  res.status(204).send();
});

export default router;
