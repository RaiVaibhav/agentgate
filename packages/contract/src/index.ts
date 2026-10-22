export * from './schema';

import { AgentGateContractSchema, type AgentGateContract } from './schema';

export function validateContract(raw: unknown): { success: true; data: AgentGateContract } | { success: false; errors: string[] } {
  const result = AgentGateContractSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
  };
}
