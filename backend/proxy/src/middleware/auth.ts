import type { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../lib/jwt.js';
import { db } from '../db/drizzle.js';
import { sessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      agentId?: string;
    }
  }
}

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifySessionToken(token);

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, payload.sessionId))
      .limit(1);

    if (!session) throw new Error('Session not found');
    if (session.status === 'revoked') throw new Error('Session has been revoked');
    if (session.expiresAt < new Date()) throw new Error('Session has expired');

    req.sessionId = payload.sessionId;
    req.agentId = payload.agentId;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid session';
    res.status(401).json({ error: message });
  }
}
