import { jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { db } from './db/drizzle.js';
import { sessions, agents, services, toolPermissions } from './db/schema.js';
import type { Session, Agent, Service, ToolPermission, DiscoveredTool } from './db/schema.js';

const key = new TextEncoder().encode(process.env.PROXY_SECRET!);

export type SessionPayload = { sessionId: string; agentId: string };

export type GatewayContext = {
  session: Session;
  agent: Agent;
  service: Service;
  tools: DiscoveredTool[];
  permissions: ToolPermission[];
};

export async function resolveToken(token: string): Promise<GatewayContext> {
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
  const { sessionId, agentId } = payload as SessionPayload;

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session) throw new Error('Session not found');
  if (session.status === 'revoked') throw new Error('Session has been revoked');
  if (session.expiresAt < new Date()) {
    await db.update(sessions).set({ status: 'expired' }).where(eq(sessions.id, sessionId));
    throw new Error('Session has expired');
  }

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) throw new Error('Agent not found');

  const [service] = await db.select().from(services).where(eq(services.id, session.serviceId)).limit(1);
  if (!service) throw new Error('Service not found for this session');

  // Load permissions for THIS session (not the service)
  const permissions = await db.select().from(toolPermissions).where(eq(toolPermissions.sessionId, session.id));

  const tools = (service.tools as DiscoveredTool[]) ?? [];

  return { session, agent, service, tools, permissions };
}
