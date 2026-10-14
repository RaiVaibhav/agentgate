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
import { approvals } from './db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { decide } from './engine.js';
import { resolveToken } from './auth.js';
import { scanResponse, extractTextFromResult } from './responseChecker.js';
import { decryptObject } from './crypto.js';
import { logAuditEvent } from './audit.js';
import { circuitBreaker } from './circuitBreaker.js';
import { dispatchApprovalNotification } from './notifications.js';

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
  const startTime = Date.now();
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

  const rawHeaders = (service.headers as Record<string, string>) ?? {};
  const activeHeaders = decryptObject(rawHeaders);

  // 2. Non-tool-call messages — forward directly (tools/list, initialize, etc.)
  if (msg.method !== 'tools/call') {
    if (!service.url) {
      res.status(400).json({ error: 'Service has no remote URL configured' });
      return;
    }
    const result = await forwardToRemote(service.url, activeHeaders, msg);
    res.json(result);
    return;
  }

  // 3. It's a tools/call — check loop & circuit breaker
  const toolName = (msg.params?.name as string) ?? '';
  const toolArgs = (msg.params?.arguments as Record<string, unknown>) ?? {};

  const breakerStatus = circuitBreaker.check(session.id, toolName, toolArgs);
  if (breakerStatus.tripped) {
    await logAuditEvent({
      sessionId: session.id,
      agentId: agent.id,
      serviceId: service.id,
      toolName,
      toolArgs,
      effect: 'denied',
      reason: `Circuit Breaker: ${breakerStatus.reason}`,
      latencyMs: Date.now() - startTime,
    });

    res.json({
      jsonrpc: '2.0',
      id: msg.id ?? null,
      result: {
        content: [
          {
            type: 'text',
            text: `⚠️ Circuit Breaker Tripped\n\n${breakerStatus.reason}`,
          },
        ],
        isError: true,
        circuitBreakerTripped: true,
      },
    });
    return;
  }

  // 4. Decide permission
  const decision = decide(permissions, toolName, toolArgs);
  const isWatchMode = session.mode === 'watch';

  // ── WATCH MODE HANDLING (Shadow / Observation) ──────────────────────────────
  if (isWatchMode) {
    const simulatedEffect = decision.effect;
    const watchReason = `[WATCH MODE] Would have resulted in ${simulatedEffect.toUpperCase()}: ${decision.reason}`;

    // In watch mode, we log the observation but DO NOT block
    await logAuditEvent({
      sessionId: session.id,
      agentId: agent.id,
      serviceId: service.id,
      toolName,
      toolArgs,
      effect: 'allowed',
      simulatedEffect,
      reason: watchReason,
      matchedPermissionId: decision.matchedPermissionId,
      latencyMs: Date.now() - startTime,
    });

    if (!service.url) {
      res.status(400).json({ error: 'Service has no remote URL configured' });
      return;
    }

    try {
      const result = await forwardToRemote(service.url, activeHeaders, msg);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `[WATCH MODE] Failed to forward to remote MCP: ${message}` });
    }
    return;
  }

  // ── ENFORCE MODE HANDLING ──────────────────────────────────────────────────

  // 5. If denied — log and return error, do NOT forward
  if (decision.effect === 'denied') {
    await logAuditEvent({
      sessionId: session.id,
      agentId: agent.id,
      serviceId: service.id,
      toolName,
      toolArgs,
      effect: 'denied',
      reason: decision.reason,
      matchedPermissionId: decision.matchedPermissionId,
      latencyMs: Date.now() - startTime,
    });

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

  // 6. If requires human approval — verify if approved or queue pending approval
  if (decision.effect === 'requires_approval') {
    const [approved] = await db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.sessionId, session.id),
          eq(approvals.toolName, toolName),
          eq(approvals.status, 'approved')
        )
      )
      .orderBy(desc(approvals.resolvedAt))
      .limit(1);

    if (!approved) {
      const [existingPending] = await db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.sessionId, session.id),
            eq(approvals.toolName, toolName),
            eq(approvals.status, 'pending')
          )
        )
        .orderBy(desc(approvals.requestedAt))
        .limit(1);

      let approvalId = existingPending?.id;
      if (!approvalId) {
        const [created] = await db
          .insert(approvals)
          .values({
            sessionId: session.id,
            agentId: agent.id,
            serviceId: service.id,
            toolName,
            toolArgs,
            status: 'pending',
            reason: decision.reason,
          })
          .returning();
        approvalId = created.id;

        // Dispatch Slack/Webhook notification
        dispatchApprovalNotification({
          approvalId: created.id,
          agentName: agent.name,
          toolName,
          toolArgs,
          reason: decision.reason,
        }).catch((err) => console.error('Notification dispatch error:', err));
      }

      await logAuditEvent({
        sessionId: session.id,
        agentId: agent.id,
        serviceId: service.id,
        toolName,
        toolArgs,
        effect: 'requires_approval',
        reason: decision.reason,
        matchedPermissionId: decision.matchedPermissionId,
        latencyMs: Date.now() - startTime,
      });

      res.json({
        jsonrpc: '2.0',
        id: msg.id ?? null,
        result: {
          content: [
            {
              type: 'text',
              text: `⏳ Action Requires Human Approval\n\nTool: ${toolName}\nApproval Request ID: ${approvalId}\nStatus: PENDING_APPROVAL\nReason: ${decision.reason}\n\nThis high-risk action requires human authorization. Please approve this request in the AgentGate dashboard.`,
            },
          ],
          isError: true,
          requiresApproval: true,
          approvalId,
        },
      });
      return;
    }
  }

  // 7. Allowed (or human approved) — forward to remote MCP server
  if (!service.url) {
    res.status(400).json({ error: 'Service has no remote URL configured' });
    return;
  }

  try {
    const result = await forwardToRemote(service.url, activeHeaders, msg);
    const latencyMs = Date.now() - startTime;

    // 8. Response security scan (if enabled)
    if (session.responseCheckEnabled === 'true') {
      const text = extractTextFromResult(result);
      const scan = scanResponse(text);
      if (!scan.safe) {
        await logAuditEvent({
          sessionId: session.id,
          agentId: agent.id,
          serviceId: service.id,
          toolName: toolName + ':response_blocked',
          toolArgs: { issues: scan.issues },
          effect: 'denied',
          reason: `Response blocked: ${scan.issues.map((i) => i.description).join(', ')}`,
          latencyMs,
        });

        res.json({
          jsonrpc: '2.0',
          id: msg.id ?? null,
          result: {
            content: [
              {
                type: 'text',
                text: `⚠️ Response blocked by security scanner\n\nIssues found:\n${scan.issues.map((i) => `• ${i.description}`).join('\n')}`,
              },
            ],
            isError: true,
          },
        });
        return;
      }
    }

    // 9. Log successful execution
    await logAuditEvent({
      sessionId: session.id,
      agentId: agent.id,
      serviceId: service.id,
      toolName,
      toolArgs,
      effect: 'allowed',
      reason: decision.reason,
      matchedPermissionId: decision.matchedPermissionId,
      latencyMs,
    });

    // 10. Return clean response to agent
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Failed to forward to remote MCP: ${message}` });
  }
}

