CREATE TABLE "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" integer NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "human_owner" text,
  "mandate" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "command" text,
  "args" jsonb NOT NULL DEFAULT '[]',
  "env" jsonb NOT NULL DEFAULT '{}',
  "url" text,
  "headers" jsonb NOT NULL DEFAULT '{}',
  "tools" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "mode" text NOT NULL DEFAULT 'enforce',
  "response_check_enabled" text NOT NULL DEFAULT 'false'
);

CREATE TABLE "tool_permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "tool_name" text NOT NULL,
  "effect" text NOT NULL,
  "path_arg" text,
  "path_pattern" text,
  "param_rules" jsonb,
  "priority" integer NOT NULL DEFAULT 1,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid REFERENCES "sessions"("id"),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id"),
  "service_id" uuid REFERENCES "services"("id"),
  "tool_name" text NOT NULL,
  "tool_args" jsonb,
  "effect" text NOT NULL,
  "reason" text NOT NULL,
  "matched_permission_id" uuid REFERENCES "tool_permissions"("id"),
  "prev_hash" text,
  "entry_hash" text,
  "latency_ms" integer,
  "simulated_effect" text,
  "timestamp" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "tool_name" text NOT NULL,
  "tool_args" jsonb NOT NULL DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'pending',
  "reason" text,
  "requested_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "resolved_by" integer,
  "decision_notes" text
);


