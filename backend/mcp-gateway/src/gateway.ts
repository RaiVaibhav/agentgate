/**
 * MCP Gateway — Streamable HTTP transport
 *
 * Single endpoint: POST /mcp/:token
 * Agent sends JSON-RPC, gets JSON back. Stateless. No SSE connection required.
 *
 * Flow:
 *   1. Validate session token
 *   2. If tools/call → check permissions → if denied, return error
 *   3. If allowed → forward to remote MCP server → scan response → return
 *   4. For all other methods (tools/list, initialize, etc.) → forward directly
 */

import type { Request, Response } from 'express';
import { db } from './db/drizzle.js';
import { auditLog } from './db/schema.js';
import { decide } from './engine.js';
import { resolveToken } from './auth.js';
import { scanResponse, extractTextFromResult } from './responseChecker.js';

// ── Forward to remote MCP server ──────────────────────────────────────────────

async function forwardToRemote(
  url: string,
  headers: Record<string, string>,
  msg: unknown
): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify(msg),
  });

  const contentType = res.headers.get('content-type') ?? '';

  // Handle SSE response (some servers stream results)
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        try { return JSON.parse(line.slice(6)); } catch { /* keep scanning */ }
      }
    }
    return { error: 'No response found in SSE stream from remote server' };
  }

  // Handle JSON response
  if (!res.ok) {
    const text = await res.text();
    return { jsonrpc: '2.0', id: null, error: { code: res.status, message: text } };
  }

  return res.json();
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleMessage(req: Request, res: Response) {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  // 1. Validate token
  let ctx;
  try {
    ctx = await resolveToken(token);
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Invalid token' });
    return;
  }

  const { session, agent, service, permissions } = ctx;
  const msg = req.body;

  if (!msg || !msg.method) {
    res.status(400).json({ error: 'Invalid JSON-RPC message' });
    return;
  }

  // 2. Non-tool-call messages — forward directly (tools/list, initialize, etc.)
  if (msg.method !== 'tools/call') {
    if (!service.url) {
      res.status(400).json({ error: 'Service has no remote URL configured' });
      return;
    }
    const result = await forwardToRemote(service.url, (service.headers as Record<string, string>) ?? {}, msg);
    res.json(result);
    return;
  }

  // 3. It's a tools/call — enforce permissions
  const toolName = (msg.params?.name as string) ?? '';
  const toolArgs = (msg.params?.arguments as Record<string, unknown>) ?? {};

  const decision = decide(permissions, toolName, toolArgs);

  // Log to audit_log
  await db.insert(auditLog).values({
    sessionId: session.id,
    agentId: agent.id,
    serviceId: service.id,
    toolName,
    toolArgs,
    effect: decision.effect,
    reason: decision.reason,
    matchedPermissionId: decision.matchedPermissionId,
  });

  // 4. If denied — return error, do NOT forward
  if (decision.effect === 'denied') {
    res.json({
      jsonrpc: '2.0',
      id: msg.id ?? null,
      result: {
        content: [{ type: 'text', text: `🚫 Permission denied\n\nTool: ${toolName}\nReason: ${decision.reason}` }],
        isError: true,
      },
    });
    return;
  }

  // 5. Allowed — forward to remote MCP server
  if (!service.url) {
    res.status(400).json({ error: 'Service has no remote URL configured' });
    return;
  }

  try {
    const result = await forwardToRemote(service.url, (service.headers as Record<string, string>) ?? {}, msg);

    // 6. Response security scan (if enabled)
    if (session.responseCheckEnabled === 'true') {
      const text = extractTextFromResult(result);
      const scan = scanResponse(text);
      if (!scan.safe) {
        await db.insert(auditLog).values({
          sessionId: session.id,
          agentId: agent.id,
          serviceId: service.id,
          toolName: toolName + ':response_blocked',
          toolArgs: { issues: scan.issues },
          effect: 'denied',
          reason: `Response blocked: ${scan.issues.map(i => i.description).join(', ')}`,
          matchedPermissionId: null,
        });
        res.json({
          jsonrpc: '2.0',
          id: msg.id ?? null,
          result: {
            content: [{ type: 'text', text: `⚠️ Response blocked by security scanner\n\nIssues found:\n${scan.issues.map(i => `• ${i.description}`).join('\n')}` }],
            isError: true,
          },
        });
        return;
      }
    }

    // 7. Return clean response to agent
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Failed to forward to remote MCP: ${message}` });
  }
}
