import { Router } from 'express';
import { db } from '../db/drizzle';
import { posts } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { NewPost } from '../db/schema';

const router = Router();

// GET /api/posts
router.get('/', async (_req, res) => {
  const all = await db.select().from(posts).orderBy(posts.createdAt);
  res.json(all);
});

// GET /api/posts/:id
router.get('/:id', async (req, res) => {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, parseInt(req.params.id, 10)))
    .limit(1);

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  res.json(post);
});

// POST /api/posts
router.post('/', async (req, res) => {
  const { title, content, published } = req.body as Partial<NewPost>;

  if (!title || !content) {
    res.status(400).json({ error: 'title and content are required' });
    return;
  }

  const [post] = await db
    .insert(posts)
    .values({ title, content, published: published ?? false })
    .returning();

  res.status(201).json(post);
});

// PATCH /api/posts/:id
router.patch('/:id', async (req, res) => {
  const { title, content, published } = req.body as Partial<NewPost>;

  const [post] = await db
    .update(posts)
    .set({ title, content, published, updatedAt: new Date() })
    .where(eq(posts.id, parseInt(req.params.id, 10)))
    .returning();

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  res.json(post);
});

// DELETE /api/posts/:id
router.delete('/:id', async (req, res) => {
  await db.delete(posts).where(eq(posts.id, parseInt(req.params.id, 10)));
  res.status(204).send();
});

export default router;
