import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Agents ──────────────────────────────────────────────────────────────────
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  humanOwner: text('human_owner'),
  mandate: text('mandate'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Services ────────────────────────────────────────────────────────────────
// A target MCP server config attached to an agent.
// Stores the mcp.json config + discovered tools.
// Permissions are per-session, NOT per-service.
export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  command: text('command'),
  args: jsonb('args').notNull().default([]),
  env: jsonb('env').notNull().default({}),
  url: text('url'),
  headers: jsonb('headers').notNull().default({}),
  tools: jsonb('tools').notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Sessions ────────────────────────────────────────────────────────────────
// Time-bounded JWT tied to an agent + service.
// Each session has its own set of tool permissions.
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  status: text('status').notNull().default('active'),
  mode: text('mode').notNull().default('enforce'), // 'enforce' | 'watch'
  responseCheckEnabled: text('response_check_enabled').notNull().default('false'),
});

// ─── Tool Permissions ────────────────────────────────────────────────────────
// Per-tool allow/deny scoped to a SESSION (not service).
// Different sessions can have different permissions for the same agent/service.
export const toolPermissions = pgTable('tool_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  effect: text('effect').notNull(),
  pathArg: text('path_arg'),
  pathPattern: text('path_pattern'),
  paramRules: jsonb('param_rules'),
  priority: integer('priority').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Audit Log ───────────────────────────────────────────────────────────────
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id),
  serviceId: uuid('service_id').references(() => services.id),
  toolName: text('tool_name').notNull(),
  toolArgs: jsonb('tool_args'),
  effect: text('effect').notNull(),
  reason: text('reason').notNull(),
  matchedPermissionId: uuid('matched_permission_id').references(() => toolPermissions.id),
  prevHash: text('prev_hash'),
  entryHash: text('entry_hash'),
  latencyMs: integer('latency_ms'),
  simulatedEffect: text('simulated_effect'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

// ─── Approvals ───────────────────────────────────────────────────────────────
export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  toolArgs: jsonb('tool_args').notNull().default({}),
  status: text('status').notNull().default('pending'),
  reason: text('reason'),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: integer('resolved_by'),
  decisionNotes: text('decision_notes'),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const agentsRelations = relations(agents, ({ many }) => ({
  services: many(services),
  sessions: many(sessions),
  auditLogs: many(auditLog),
  approvals: many(approvals),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  agent: one(agents, { fields: [services.agentId], references: [agents.id] }),
  sessions: many(sessions),
  approvals: many(approvals),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  agent: one(agents, { fields: [sessions.agentId], references: [agents.id] }),
  service: one(services, { fields: [sessions.serviceId], references: [services.id] }),
  toolPermissions: many(toolPermissions),
  auditLogs: many(auditLog),
  approvals: many(approvals),
}));

export const toolPermissionsRelations = relations(toolPermissions, ({ one }) => ({
  session: one(sessions, { fields: [toolPermissions.sessionId], references: [sessions.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  session: one(sessions, { fields: [auditLog.sessionId], references: [sessions.id] }),
  agent: one(agents, { fields: [auditLog.agentId], references: [agents.id] }),
  service: one(services, { fields: [auditLog.serviceId], references: [services.id] }),
  matchedPermission: one(toolPermissions, {
    fields: [auditLog.matchedPermissionId],
    references: [toolPermissions.id],
  }),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  session: one(sessions, { fields: [approvals.sessionId], references: [sessions.id] }),
  agent: one(agents, { fields: [approvals.agentId], references: [agents.id] }),
  service: one(services, { fields: [approvals.serviceId], references: [services.id] }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ToolPermission = typeof toolPermissions.$inferSelect;
export type NewToolPermission = typeof toolPermissions.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;

export type DiscoveredTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type Effect = 'allow' | 'deny' | 'require_approval';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type SessionStatus = 'active' | 'expired' | 'revoked';
export type SessionMode = 'enforce' | 'watch';

export type ParamRule = {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'regex' | 'regex_not_match';
  value: unknown;
};
