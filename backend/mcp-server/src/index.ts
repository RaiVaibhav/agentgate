#!/usr/bin/env node
/**
 * Agent Permission MCP Server
 *
 * This MCP server wraps real actions (read files, call endpoints) with
 * permission checks against the proxy before executing anything.
 *
 * Every tool call follows this pattern:
 *   1. POST /check to proxy with session token
 *   2. If denied → return error to the AI, nothing executed
 *   3. If allowed → execute the actual action, return result
 *
 * Configuration (env vars or CLI args):
 *   SESSION_TOKEN  — the proxy session JWT (from the dashboard Sessions tab)
 *   PROXY_URL      — proxy base URL (default: http://localhost:3001)
 *   DUMMY_APP_URL  — dummy app base URL (default: http://localhost:3002)
 *   PROJECT_ROOT   — root path for file operations (default: cwd)
 */

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const SESSION_TOKEN = process.env.SESSION_TOKEN ?? '';
const PROXY_URL = process.env.PROXY_URL ?? 'http://localhost:3001';
const DUMMY_APP_URL = process.env.DUMMY_APP_URL ?? 'http://localhost:3002';
const PROJECT_ROOT = process.env.PROJECT_ROOT ?? process.cwd();

if (!SESSION_TOKEN) {
  process.stderr.write(
    '[agent-permission-mcp] ERROR: SESSION_TOKEN env var is required.\n' +
    'Create a session in the dashboard at /agents/sessions and set SESSION_TOKEN=<token>\n'
  );
  process.exit(1);
}

// ── Permission check ──────────────────────────────────────────────────────────

type ResourceType = 'file' | 'endpoint' | 'database';
type Action = 'read' | 'write' | 'delete';

type CheckResult = {
  effect: 'allowed' | 'denied' | 'anomaly';
  reason: string;
  matchedRuleId: string | null;
};

async function checkPermission(
  resourceType: ResourceType,
  resourcePath: string,
  action: Action
): Promise<CheckResult> {
  const res = await fetch(`${PROXY_URL}/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SESSION_TOKEN}`,
    },
    body: JSON.stringify({ resourceType, resourcePath, action }),
  });

  if (res.status === 401) {
    return {
      effect: 'denied',
      reason: 'Session token is invalid or expired. Create a new session in the dashboard.',
      matchedRuleId: null,
    };
  }

  return res.json() as Promise<CheckResult>;
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'agent-permission-mcp',
  version: '0.1.0',
});

// ── Tool: read_file ───────────────────────────────────────────────────────────

server.tool(
  'read_file',
  'Read the contents of a file. Permission is checked before reading — sensitive files like .env will be blocked.',
  {
    filePath: z.string().describe(
      'Path to the file, relative to project root (e.g. src/index.ts) or absolute'
    ),
  },
  async ({ filePath }) => {
    // Normalise to an absolute path
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(PROJECT_ROOT, filePath);

    // Use a path relative to project root for the rule pattern match
    const relativePath = '/' + path.relative(PROJECT_ROOT, absPath).replace(/\\/g, '/');

    // ── Permission check ──
    const check = await checkPermission('file', relativePath, 'read');

    if (check.effect !== 'allowed') {
      return {
        content: [
          {
            type: 'text',
            text: `🚫 Access denied\n\nFile: ${relativePath}\nReason: ${check.reason}\n\nThis access attempt has been logged.`,
          },
        ],
        isError: true,
      };
    }

    // ── Execute ──
    try {
      const content = await fs.readFile(absPath, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text: `✅ Allowed\nFile: ${relativePath}\n\n${content}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error reading file: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: list_files ──────────────────────────────────────────────────────────

server.tool(
  'list_files',
  'List files in a directory. Permission is checked against the directory path.',
  {
    dirPath: z.string().describe(
      'Directory path, relative to project root (e.g. src/) or absolute'
    ),
  },
  async ({ dirPath }) => {
    const absPath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(PROJECT_ROOT, dirPath);
    const relativePath = '/' + path.relative(PROJECT_ROOT, absPath).replace(/\\/g, '/');

    const check = await checkPermission('file', relativePath + '/', 'read');

    if (check.effect !== 'allowed') {
      return {
        content: [
          {
            type: 'text',
            text: `🚫 Access denied\n\nDirectory: ${relativePath}\nReason: ${check.reason}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const entries = await fs.readdir(absPath, { withFileTypes: true });
      const listing = entries
        .map((e) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
        .join('\n');
      return {
        content: [
          {
            type: 'text',
            text: `✅ Allowed\nDirectory: ${relativePath}\n\n${listing}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error listing directory: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: call_endpoint ───────────────────────────────────────────────────────

server.tool(
  'call_endpoint',
  'Make an HTTP request to the dummy app API. Permission is checked before the request is sent.',
  {
    path: z.string().describe('API path, e.g. /api/posts or /api/posts/1'),
    method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']).default('GET'),
    body: z.record(z.unknown()).optional().describe('Request body for POST/PATCH'),
  },
  async ({ path: apiPath, method, body }) => {
    const action: Action =
      method === 'GET' ? 'read' :
      method === 'DELETE' ? 'delete' :
      'write';

    const check = await checkPermission('endpoint', apiPath, action);

    if (check.effect !== 'allowed') {
      return {
        content: [
          {
            type: 'text',
            text: `🚫 Access denied\n\nEndpoint: ${method} ${apiPath}\nReason: ${check.reason}\n\nThis access attempt has been logged.`,
          },
        ],
        isError: true,
      };
    }

    // ── Execute ──
    try {
      const res = await fetch(`${DUMMY_APP_URL}${apiPath}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.text();
      return {
        content: [
          {
            type: 'text',
            text: `✅ Allowed\n${method} ${apiPath} → ${res.status}\n\n${data}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error calling endpoint: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('[agent-permission-mcp] MCP server running via stdio\n');
