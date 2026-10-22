import { z } from "zod";

export const VerdictTypeSchema = z.enum(["ALLOW", "BLOCK", "ESCALATE"]);
export const ComparisonOpSchema = z.enum([
  "eq",
  "neq",
  "lte",
  "gte",
  "lt",
  "gt",
  "in",
  "lte_field",
]);

export const OwnershipRuleSchema = z.object({
  source: z.string(),
  lookupTool: z.string(),
  matchArg: z.string(), // e.g., "orderId"
  ownerField: z.string(), // e.g., "userId" in lookupTool output
  equalsContext: z.literal("principalId"),
  onViolation: z.literal("BLOCK"),
});

export const PreconditionRuleSchema = z.object({
  id: z.string(),
  source: z.string(), // e.g., "routes/refunds.ts:L18"
  whenArg: z
    .object({
      field: z.string(),
      op: ComparisonOpSchema,
      value: z.union([z.string(), z.number(), z.boolean()]),
    })
    .optional(),
  lookupTool: z.string(), // e.g., "get_order" or "verify_damage_report"
  matchArg: z.string(), // e.g., "orderId"
  field: z.string().optional(), // field on lookupTool output, e.g., "status"
  argField: z.string().optional(), // field on current tool args when comparing arg to lookup output
  op: ComparisonOpSchema,
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .optional(),
  targetField: z.string().optional(), // used when op === "lte_field", e.g., "totalPaid_cents"
  onViolation: VerdictTypeSchema,
});

export const ThresholdRuleSchema = z.object({
  id: z.string(),
  source: z.string(),
  argField: z.string(), // e.g., "amount_cents"
  op: ComparisonOpSchema, // e.g., "lte" (if amount_cents <= 5000 allow, else onViolation)
  value: z.number(), // e.g., 5000
  unitConversionNote: z.string().optional(),
  onViolation: VerdictTypeSchema, // e.g., "ESCALATE"
});

export const MutualExclusionRuleSchema = z.object({
  source: z.string(),
  conflictingTools: z.array(z.string()),
  scopeKey: z.string(), // e.g., "orderId"
  onViolation: z.literal("BLOCK"),
});

export const BudgetRuleSchema = z.object({
  source: z.string(),
  argField: z.string(), // e.g., "amount_cents"
  sharedAcrossTools: z.array(z.string()), // e.g., ["issue_refund", "add_wallet_credit"]
  scope: z.literal("principalId"),
  windowSeconds: z.number(), // e.g., 86400
  maxTotal: z.number(), // e.g., 10000
  unitConversionNote: z.string().optional(),
  onViolation: z.literal("BLOCK"),
});

export const ToolContractSchema = z.object({
  ownership: OwnershipRuleSchema.optional(),
  preconditions: z.array(PreconditionRuleSchema).default([]),
  thresholds: z.array(ThresholdRuleSchema).default([]),
  mutualExclusion: MutualExclusionRuleSchema.optional(),
  budget: BudgetRuleSchema.optional(),
});

export const UnmappableRuleSchema = z.object({
  source: z.string(),
  rawText: z.string(),
  reason: z.string(),
});

export const AgentGateContractSchema = z.object({
  version: z.literal("2.0"),
  tools: z.record(z.string(), ToolContractSchema),
  unmappableRules: z.array(UnmappableRuleSchema).default([]),
});

export type AgentGateContract = z.infer<typeof AgentGateContractSchema>;
export type ToolContract = z.infer<typeof ToolContractSchema>;
export type PreconditionRule = z.infer<typeof PreconditionRuleSchema>;
export type ThresholdRule = z.infer<typeof ThresholdRuleSchema>;
export type OwnershipRule = z.infer<typeof OwnershipRuleSchema>;
export type MutualExclusionRule = z.infer<typeof MutualExclusionRuleSchema>;
export type BudgetRule = z.infer<typeof BudgetRuleSchema>;
export type UnmappableRule = z.infer<typeof UnmappableRuleSchema>;
export type VerdictType = z.infer<typeof VerdictTypeSchema>;
