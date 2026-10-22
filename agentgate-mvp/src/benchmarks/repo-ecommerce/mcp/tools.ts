export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  returnSchema?: Record<string, any>;
}

export const tools: ToolDefinition[] = [
  {
    name: "get_user_orders",
    description: "Fetch a list of recent order summaries for a given user.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The ID of the user" },
      },
      required: ["userId"],
    },
    returnSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          orderId: { type: "string" },
          status: { type: "string" },
        },
      },
    },
  },
  {
    name: "get_order",
    description: "Fetch detailed order records including payment totals and fulfillment timestamps.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The unique order identifier" },
      },
      required: ["orderId"],
    },
    returnSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        userId: { type: "string" },
        status: { type: "string" },
        totalPaid_cents: { type: "number" },
        daysSinceDelivery: { type: "number" },
      },
      required: ["orderId", "userId", "status", "totalPaid_cents", "daysSinceDelivery"],
    },
  },
  {
    name: "verify_damage_report",
    description: "Check if an official inspection report has verified customer damage claims.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order identifier" },
      },
      required: ["orderId"],
    },
    returnSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        verified: { type: "boolean" },
      },
      required: ["orderId", "verified"],
    },
  },
  {
    name: "issue_refund",
    description: "Issue a monetary refund to the original payment method.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order identifier" },
        amount_cents: { type: "number", description: "Refund amount in integer cents" },
        reason: { type: "string", description: "Reason for the refund" },
      },
      required: ["orderId", "amount_cents", "reason"],
    },
  },
  {
    name: "add_wallet_credit",
    description: "Deposit store credit into the customer wallet balance.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order identifier" },
        amount_cents: { type: "number", description: "Credit amount in integer cents" },
      },
      required: ["orderId", "amount_cents"],
    },
  },
  {
    name: "apply_discount_code",
    description: "Apply a promo or goodwill discount code to an order.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order identifier" },
        code: { type: "string", description: "Promo discount code" },
      },
      required: ["orderId", "code"],
    },
  },
];
