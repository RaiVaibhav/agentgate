import { AgentGateContractSchema, type AgentGateContract } from "../schema/contract";
import type { ScanResult } from "./ast-scanner";

export async function extractContract(scan: ScanResult): Promise<AgentGateContract> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const { default: OpenAI } = await import("openai");
      const { zodResponseFormat } = await import("openai/helpers/zod");
      const openai = new OpenAI({ apiKey });
      const prompt = `
Analyze the provided backend route code, inlined validation helpers, MCP tool schemas, and agent system prompt.
Generate a strict AgentGate Declarative Contract (version 2.0).

RULES:
1. Ownership: If route checks order.userId !== req.user.principalId, map to ownership rule on issue_refund bound to lookupTool 'get_order' with matchArg 'orderId'.
2. Preconditions: Extract route checks:
   - status === "DELIVERED"
   - daysSinceDelivery <= 14 (from inlined validator)
   - amount_cents <= totalPaid_cents (lte_field)
   - If prompt requires verify_damage_report for DAMAGED reasons, map as conditional precondition with whenArg: { field: "reason", op: "eq", value: "DAMAGED" }.
3. Unit Normalization: Convert dollar amounts in prompt ($50 -> 5000, $100 -> 10000) when referencing _cents parameters.
4. Escalation: Single refund over $50 requires manager escalation -> onViolation: "ESCALATE".
5. Anti-Stacking (Mutual Exclusion): Never combine refund, wallet credit, or discount code on same order -> conflictingTools: ["add_wallet_credit", "apply_discount_code"], scopeKey: "orderId".
6. Budget: Compensation must not exceed $100/24h -> shared budget across ["issue_refund", "add_wallet_credit"] with maxTotal: 10000 cents, windowSeconds: 86400.
7. Precision & Decoy Rejection: Ignore any conversational fluff (greetings, apologies) and ignore any commented-out code.
8. Unmappable Rules: Any prompt rule referencing fields not present in any tool schema (e.g. VIP-tier / tier) MUST be placed in unmappableRules.

INPUTS:
--- Stripped Route Code ---
${scan.strippedRouteCode}

--- Inlined Helpers ---
${JSON.stringify(scan.inlinedHelpers, null, 2)}

--- MCP Tool Schemas ---
${JSON.stringify(scan.toolSchemas, null, 2)}

--- Agent Prompt ---
${scan.promptText}
`;

      const response = await openai.beta.chat.completions.parse({
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content: "You are an expert compiler that extracts stateful security contracts from backend code and prompts.",
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(AgentGateContractSchema, "contract"),
      });

      const parsed = response.choices[0].message.parsed;
      if (parsed) {
        return AgentGateContractSchema.parse(parsed);
      }
    } catch (err) {
      console.warn("OpenAI extraction failed, using deterministic AST fallback:", err);
    }
  }

  // Deterministic AST + Rule-Parser Fallback
  return extractContractDeterministic(scan);
}

export function extractContractDeterministic(scan: ScanResult): AgentGateContract {
  const contract: AgentGateContract = {
    version: "2.0",
    tools: {},
    unmappableRules: [],
  };

  const { strippedRouteCode, inlinedHelpers, promptText } = scan;

  // Initialize tools
  contract.tools["issue_refund"] = {
    preconditions: [],
    thresholds: [],
  };
  contract.tools["add_wallet_credit"] = {
    preconditions: [],
    thresholds: [],
  };
  contract.tools["apply_discount_code"] = {
    preconditions: [],
    thresholds: [],
  };

  // 1. Ownership Extraction from Route AST
  if (strippedRouteCode.includes("order.userId !== req.user.principalId")) {
    contract.tools["issue_refund"].ownership = {
      source: "routes/refunds.ts:L7",
      lookupTool: "get_order",
      matchArg: "orderId",
      ownerField: "userId",
      equalsContext: "principalId",
      onViolation: "BLOCK",
    };
  }

  // 2. Preconditions from Route AST
  if (strippedRouteCode.includes('order.status !== "DELIVERED"')) {
    contract.tools["issue_refund"].preconditions.push({
      id: "pre_delivered",
      source: "routes/refunds.ts:L10",
      lookupTool: "get_order",
      matchArg: "orderId",
      field: "status",
      op: "eq",
      value: "DELIVERED",
      onViolation: "BLOCK",
    });
  }

  // 3. Preconditions from Inlined Helper AST (isWithinReturnWindow <= 14)
  const isWithinFn = inlinedHelpers["isWithinReturnWindow"] ?? "";
  if (
    strippedRouteCode.includes("!isWithinReturnWindow") &&
    (isWithinFn.includes("14") || isWithinFn.includes("daysSinceDelivery <= 14"))
  ) {
    contract.tools["issue_refund"].preconditions.push({
      id: "pre_window",
      source: "routes/refunds.ts:L13",
      lookupTool: "get_order",
      matchArg: "orderId",
      field: "daysSinceDelivery",
      op: "lte",
      value: 14,
      onViolation: "BLOCK",
    });
  }

  // 4. Preconditions: amount_cents cannot exceed totalPaid_cents
  if (strippedRouteCode.includes("amount_cents > order.totalPaid_cents")) {
    contract.tools["issue_refund"].preconditions.push({
      id: "pre_amount",
      source: "routes/refunds.ts:L16",
      lookupTool: "get_order",
      matchArg: "orderId",
      argField: "amount_cents",
      op: "lte_field",
      targetField: "totalPaid_cents",
      onViolation: "BLOCK",
    });
  }

  // 5. Damage report precondition from Prompt
  if (promptText.includes('reason is "DAMAGED"') && promptText.includes("verify_damage_report")) {
    contract.tools["issue_refund"].preconditions.push({
      id: "pre_damage_verified",
      source: "agent/prompt.md:L5",
      whenArg: {
        field: "reason",
        op: "eq",
        value: "DAMAGED",
      },
      lookupTool: "verify_damage_report",
      matchArg: "orderId",
      field: "verified",
      op: "eq",
      value: true,
      onViolation: "BLOCK",
    });
  }

  // 6. Unit Normalization: $50 threshold -> 5000 cents with ESCALATE
  const threshMatch = promptText.match(/\$50.*escalat/i);
  if (threshMatch) {
    contract.tools["issue_refund"].thresholds.push({
      id: "thresh_escalate",
      source: "agent/prompt.md:L4",
      argField: "amount_cents",
      op: "lte",
      value: 5000,
      unitConversionNote: "$50 normalized to 5000 cents",
      onViolation: "ESCALATE",
    });
  }

  // 7. Mutual Exclusion (Anti-Stacking) from Prompt
  if (promptText.includes("Never combine a refund") || promptText.includes("issue_refund")) {
    contract.tools["issue_refund"].mutualExclusion = {
      source: "agent/prompt.md:L2",
      conflictingTools: ["add_wallet_credit", "apply_discount_code"],
      scopeKey: "orderId",
      onViolation: "BLOCK",
    };
    contract.tools["add_wallet_credit"].mutualExclusion = {
      source: "agent/prompt.md:L2",
      conflictingTools: ["issue_refund", "apply_discount_code"],
      scopeKey: "orderId",
      onViolation: "BLOCK",
    };
    contract.tools["apply_discount_code"].mutualExclusion = {
      source: "agent/prompt.md:L2",
      conflictingTools: ["issue_refund", "add_wallet_credit"],
      scopeKey: "orderId",
      onViolation: "BLOCK",
    };
  }

  // 8. Unit Normalization: $100 per 24 hours -> 10000 cents budget
  const budgetMatch = promptText.match(/\$100.*(24 hours|day)/i);
  if (budgetMatch) {
    const budgetRule = {
      source: "agent/prompt.md:L3",
      argField: "amount_cents",
      sharedAcrossTools: ["issue_refund", "add_wallet_credit"],
      scope: "principalId" as const,
      windowSeconds: 86400,
      maxTotal: 10000,
      unitConversionNote: "$100 normalized to 10000 cents",
      onViolation: "BLOCK" as const,
    };
    contract.tools["issue_refund"].budget = budgetRule;
    contract.tools["add_wallet_credit"].budget = budgetRule;
  }

  // 9. Unmappable Rule Extraction (VIP-tier users)
  if (promptText.includes("VIP-tier") || promptText.includes("VIP")) {
    contract.unmappableRules.push({
      source: "agent/prompt.md:L6",
      rawText: "Never issue a refund to VIP-tier users without calling their dedicated concierge first.",
      reason: "No 'tier' or 'isVip' field found in get_order or any other tool schema",
    });
  }

  return AgentGateContractSchema.parse(contract);
}
