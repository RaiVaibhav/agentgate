import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { StatefulLedger } from '@/agentgate-mvp/src/runtime/ledger';
import { checkAndReserve } from '@/agentgate-mvp/src/runtime/enforcer';
import { AgentGateContract, type VerdictType } from '@/agentgate-mvp/src/schema/contract';

// In-memory persistent state for the sandbox session
const globalLedger = new StatefulLedger();

// Mock mock-orders database for the sandbox
const mockOrdersDb: Record<string, any> = {
  ord_101: { orderId: 'ord_101', userId: 'user_live', status: 'DELIVERED', daysSinceDelivery: 4, totalPaid_cents: 10000 },
  ord_102: { orderId: 'ord_102', userId: 'user_live', status: 'IN_TRANSIT', daysSinceDelivery: 0, totalPaid_cents: 6000 },
  ord_103: { orderId: 'ord_103', userId: 'user_live', status: 'DELIVERED', daysSinceDelivery: 25, totalPaid_cents: 5000 },
  ord_104: { orderId: 'ord_104', userId: 'other_user', status: 'DELIVERED', daysSinceDelivery: 2, totalPaid_cents: 8000 },
  ord_damaged: { orderId: 'ord_damaged', userId: 'user_live', status: 'DELIVERED', daysSinceDelivery: 3, totalPaid_cents: 7500 },
};

// Inspection reports DB
const damageReportsDb: Record<string, boolean> = {
  ord_damaged: false, // by default unverified until inspected
};

function getContract(): AgentGateContract {
  const gtPath = path.join(process.cwd(), 'agentgate-mvp/src/benchmarks/repo-ecommerce/ground-truth.json');
  return JSON.parse(fs.readFileSync(gtPath, 'utf8'));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId = 'session_sandbox', principalId = 'user_live' } = body;

    const contract = getContract();
    const toolEvents: any[] = [];
    let assistantMessage = '';

    // ── Real Tool Implementations ─────────────────────────────────────────────
    const tools = {
      get_order: async (args: { orderId: string }) => {
        const order = mockOrdersDb[args.orderId];
        if (!order) throw new Error(`Order ${args.orderId} not found`);
        globalLedger.recordReadOutput(sessionId, principalId, 'get_order', args, order);
        return order;
      },

      verify_damage_report: async (args: { orderId: string }) => {
        const verified = damageReportsDb[args.orderId] ?? false;
        const res = { orderId: args.orderId, verified };
        globalLedger.recordReadOutput(sessionId, principalId, 'verify_damage_report', args, res);
        return res;
      },

      issue_refund: async (args: { orderId: string; amount_cents: number; reason: string }) => {
        const callId = `call_${Date.now()}`;
        const check = checkAndReserve(globalLedger, contract, {
          callId,
          sessionId,
          principalId,
          toolName: 'issue_refund',
          args,
        });

        toolEvents.push({
          toolName: 'issue_refund',
          args,
          verdict: check.verdict,
          reason: check.reason,
          latencyMs: check.latencyMs,
        });

        if (check.verdict === 'BLOCK') {
          throw new Error(`[AgentGate Security BLOCK]: ${check.reason}`);
        }
        if (check.verdict === 'ESCALATE') {
          return {
            status: 'ESCALATED',
            message: `Action paused for human supervisor escalation: ${check.reason}`,
          };
        }

        // Commit transaction in stateful ledger
        globalLedger.commitReservation(callId, { refundId: `ref_${Date.now()}`, success: true });
        return { success: true, refundId: `ref_${Date.now()}`, amountRefunded: args.amount_cents / 100 };
      },

      add_wallet_credit: async (args: { orderId: string; amount_cents: number }) => {
        const callId = `call_${Date.now()}`;
        const check = checkAndReserve(globalLedger, contract, {
          callId,
          sessionId,
          principalId,
          toolName: 'add_wallet_credit',
          args,
        });

        toolEvents.push({
          toolName: 'add_wallet_credit',
          args,
          verdict: check.verdict,
          reason: check.reason,
          latencyMs: check.latencyMs,
        });

        if (check.verdict === 'BLOCK') {
          throw new Error(`[AgentGate Security BLOCK]: ${check.reason}`);
        }
        if (check.verdict === 'ESCALATE') {
          return {
            status: 'ESCALATED',
            message: `Action paused for supervisor review: ${check.reason}`,
          };
        }

        globalLedger.commitReservation(callId, { creditId: `crd_${Date.now()}`, success: true });
        return { success: true, creditId: `crd_${Date.now()}`, creditAdded: args.amount_cents / 100 };
      },

      apply_discount_code: async (args: { orderId: string; code: string }) => {
        const callId = `call_${Date.now()}`;
        const check = checkAndReserve(globalLedger, contract, {
          callId,
          sessionId,
          principalId,
          toolName: 'apply_discount_code',
          args,
        });

        toolEvents.push({
          toolName: 'apply_discount_code',
          args,
          verdict: check.verdict,
          reason: check.reason,
          latencyMs: check.latencyMs,
        });

        if (check.verdict === 'BLOCK') {
          throw new Error(`[AgentGate Security BLOCK]: ${check.reason}`);
        }

        return { success: true, code: args.code, discountPercent: 20 };
      },
    };

    // ── AI Agent Tool Execution Logic ─────────────────────────────────────────
    const lower = message.toLowerCase();

    if (lower.includes('credit') || lower.includes('wallet')) {
      // User asking for wallet credit
      const orderMatch = message.match(/ord_\w+/i);
      const orderId = orderMatch ? orderMatch[0] : 'ord_101';
      const amountMatch = message.match(/\$?(\d+)/);
      const amountCents = amountMatch ? parseInt(amountMatch[1], 10) * 100 : 3000;

      try {
        await tools.get_order({ orderId });
        const res = await tools.add_wallet_credit({ orderId, amount_cents: amountCents });
        assistantMessage = `I've applied a $${amountCents / 100} wallet credit to your account for order ${orderId}. Is there anything else I can help you with?`;
      } catch (err: any) {
        assistantMessage = `I'm sorry, but I cannot apply store credit: ${err.message}`;
      }
    } else if (lower.includes('discount')) {
      const orderMatch = message.match(/ord_\w+/i);
      const orderId = orderMatch ? orderMatch[0] : 'ord_101';
      try {
        await tools.get_order({ orderId });
        const res = await tools.apply_discount_code({ orderId, code: 'SAVE20' });
        assistantMessage = `I've applied a 20% discount code (SAVE20) to order ${orderId}.`;
      } catch (err: any) {
        assistantMessage = `I cannot apply this discount code: ${err.message}`;
      }
    } else if (lower.includes('refund') || lower.includes('damaged') || lower.includes('money back')) {
      const orderMatch = message.match(/ord_\w+/i);
      const orderId = orderMatch ? orderMatch[0] : (lower.includes('damaged') ? 'ord_damaged' : 'ord_101');
      const amountMatch = message.match(/\$?(\d+)/);
      const amountCents = amountMatch ? parseInt(amountMatch[1], 10) * 100 : 3000;
      const isDamaged = lower.includes('damaged');

      try {
        // Step 1: Agent lookups order
        const order = await tools.get_order({ orderId });

        // Step 2: If damaged, check damage report
        if (isDamaged && !lower.includes('skip inspection')) {
          await tools.verify_damage_report({ orderId });
        }

        // Step 3: Agent attempts refund
        const res = await tools.issue_refund({
          orderId,
          amount_cents: amountCents,
          reason: isDamaged ? 'DAMAGED' : 'Customer inquiry',
        });

        if (res.status === 'ESCALATED') {
          assistantMessage = `Your refund request for $${amountCents / 100} exceeds my autonomous limit and has been escalated to a human supervisor for review.`;
        } else {
          assistantMessage = `I have successfully processed your refund of $${amountCents / 100} for order ${orderId}. The funds should reflect in 3-5 business days.`;
        }
      } catch (err: any) {
        assistantMessage = `I apologize, but I cannot complete this refund: ${err.message}`;
      }
    } else if (lower.includes('status') || lower.includes('where is')) {
      const orderMatch = message.match(/ord_\w+/i);
      const orderId = orderMatch ? orderMatch[0] : 'ord_101';
      try {
        const order = await tools.get_order({ orderId });
        assistantMessage = `Order ${order.orderId} is currently ${order.status}. It was delivered ${order.daysSinceDelivery} days ago with total paid of $${order.totalPaid_cents / 100}.`;
      } catch (err: any) {
        assistantMessage = `Could not find order status: ${err.message}`;
      }
    } else {
      assistantMessage = `Hello! I am your AI Customer Support Agent protected by AgentGate. I can help look up your orders, process returns, issue store credits, or assist with delivery issues. What order can I help you with today?`;
    }

    // Calculate current customer spend
    const currentSpend = globalLedger.getPrincipalSpend(principalId, ['issue_refund', 'add_wallet_credit'], 'amount_cents', 86400, Date.now());

    return NextResponse.json({
      success: true,
      assistantMessage,
      toolEvents,
      ledgerSummary: {
        principalId,
        sessionId,
        currentSpendCents: currentSpend,
        currentSpendDollars: (currentSpend / 100).toFixed(2),
        maxBudgetDollars: 100,
        recordedCallsCount: globalLedger.recordedCalls.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Sandbox execution failed' },
      { status: 500 }
    );
  }
}
