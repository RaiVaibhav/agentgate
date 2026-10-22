import type { PolicyEvaluator } from '../evaluator/policyEvaluator';
import type { StatefulLedger } from '../ledger/statefulLedger';

export function wrapMcpTool<TArgs = any, TOutput = any>(
  toolName: string,
  handler: (args: TArgs, context: any) => Promise<TOutput>,
  evaluator: PolicyEvaluator,
  ledger: StatefulLedger
) {
  return async (args: TArgs, context: any): Promise<TOutput | { status: 'ESCALATED'; message: string; callId: string }> => {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const result = await evaluator.evaluate({
      callId,
      toolName,
      args: args as any,
      context,
    });

    if (result.verdict === 'BLOCK') {
      throw new Error(`[AgentGate BLOCK]: ${result.reason}`);
    }

    if (result.verdict === 'ESCALATE') {
      return {
        status: 'ESCALATED',
        message: `Action paused for human escalation: ${result.reason}`,
        callId,
      };
    }

    try {
      const output = await handler(args, context);

      const entityId = (args as any)['orderId'] || (args as any)['subscriptionId'];
      if (entityId) {
        ledger.recordToolOutput(entityId, toolName, output);
      }

      ledger.commit(callId);
      return output;
    } catch (err) {
      ledger.rollback(callId);
      throw err;
    }
  };
}
