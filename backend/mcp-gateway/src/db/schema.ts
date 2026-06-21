import { pgTable, uuid, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  command: text('command'),
  args: jsonb('args').notNull().default([]),
  env: jsonb('env').notNull().default({}),
  url: text('url'),
  headers: jsonb('headers').notNull().default({}),
  tools: jsonb('tools').notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  status: text('status').notNull().default('active'),
  responseCheckEnabled: text('response_check_enabled').notNull().default('false'),
});

export const toolPermissions = pgTable('tool_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  effect: text('effect').notNull(),
  pathArg: text('path_arg'),
  pathPattern: text('path_pattern'),
  priority: integer('priority').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id),
  agentId: uuid('agent_id').notNull().references(() => agents.id),
  serviceId: uuid('service_id').references(() => services.id),
  toolName: text('tool_name').notNull(),
  toolArgs: jsonb('tool_args'),
  effect: text('effect').notNull(),
  reason: text('reason').notNull(),
  matchedPermissionId: uuid('matched_permission_id').references(() => toolPermissions.id),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  agent: one(agents, { fields: [sessions.agentId], references: [agents.id] }),
  service: one(services, { fields: [sessions.serviceId], references: [services.id] }),
  toolPermissions: many(toolPermissions),
}));

export const toolPermissionsRelations = relations(toolPermissions, ({ one }) => ({
  session: one(sessions, { fields: [toolPermissions.sessionId], references: [sessions.id] }),
}));

export type Agent = typeof agents.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ToolPermission = typeof toolPermissions.$inferSelect;

export type DiscoveredTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};
