import { z } from 'zod';

export const OperatorSchema = z.enum([
  'eq',
  'neq',
  'lte',
  'gte',
  'lt',
  'gt',
  'in',
  'lte_field',
  'gte_field',
  'eq_field',
]);

export type Operator = z.infer<typeof OperatorSchema>;

export const ViolationActionSchema = z.enum(['BLOCK', 'ESCALATE', 'ALLOW']);
export type ViolationAction = z.infer<typeof ViolationActionSchema>;

export const OwnershipRuleSchema = z.object({
  lookupTool: z.string(),
  matchArg: z.string(),
  ownerField: z.string(),
  equalsContext: z.string(),
});
export type OwnershipRule = z.infer<typeof OwnershipRuleSchema>;

export const WhenArgSchema = z.object({
  field: z.string(),
  op: OperatorSchema,
  value: z.any(),
});
export type WhenArg = z.infer<typeof WhenArgSchema>;

export const PreconditionRuleSchema = z.object({
  source: z.string(),
  lookupTool: z.string().optional(),
  field: z.string().optional(),
  argField: z.string().optional(),
  targetField: z.string().optional(),
  op: OperatorSchema,
  value: z.any().optional(),
  whenArg: WhenArgSchema.optional(),
  requirePriorTool: z.string().optional(),
  matchArg: z.string().optional(),
  outputField: z.string().optional(),
  onViolation: ViolationActionSchema.default('BLOCK'),
});
export type PreconditionRule = z.infer<typeof PreconditionRuleSchema>;

export const ThresholdRuleSchema = z.object({
  source: z.string(),
  argField: z.string(),
  op: OperatorSchema,
  value: z.number(),
  unitConversionNote: z.string().optional(),
  onViolation: ViolationActionSchema.default('ESCALATE'),
});
export type ThresholdRule = z.infer<typeof ThresholdRuleSchema>;

export const MutualExclusionRuleSchema = z.object({
  source: z.string(),
  conflictingTools: z.array(z.string()),
  scopeKey: z.string(),
  onViolation: ViolationActionSchema.default('BLOCK'),
});
export type MutualExclusionRule = z.infer<typeof MutualExclusionRuleSchema>;

export const BudgetRuleSchema = z.object({
  source: z.string(),
  argField: z.string(),
  sharedAcrossTools: z.array(z.string()).optional(),
  scope: z.enum(['principalId', 'sessionId', 'entityId']).default('principalId'),
  windowSeconds: z.number().default(86400),
  maxTotal: z.number(),
  unitConversionNote: z.string().optional(),
  onViolation: ViolationActionSchema.default('BLOCK'),
});
export type BudgetRule = z.infer<typeof BudgetRuleSchema>;

export const ToolContractSchema = z.object({
  ownership: OwnershipRuleSchema.optional(),
  preconditions: z.array(PreconditionRuleSchema).optional().default([]),
  thresholds: z.array(ThresholdRuleSchema).optional().default([]),
  mutualExclusion: MutualExclusionRuleSchema.optional(),
  budget: BudgetRuleSchema.optional(),
});
export type ToolContract = z.infer<typeof ToolContractSchema>;

export const UnmappableRuleSchema = z.object({
  source: z.string(),
  rawText: z.string(),
  reason: z.string(),
});
export type UnmappableRule = z.infer<typeof UnmappableRuleSchema>;

export const AgentGateContractSchema = z.object({
  version: z.literal('2.0'),
  tools: z.record(z.string(), ToolContractSchema),
  unmappableRules: z.array(UnmappableRuleSchema).optional().default([]),
});
export type AgentGateContract = z.infer<typeof AgentGateContractSchema>;
