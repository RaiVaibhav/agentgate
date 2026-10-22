/**
 * MCP Tool definitions for E-Commerce Customer Support Agent.
 * Note that MCP tools operate in minor currency units (amount_cents).
 */

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export const TOOLS: McpToolDefinition[] = [
  {
    name: 'get_order',
    description: 'Look up an order by orderId. Returns order details, ownership userId, status, delivery timeline, and total amount in cents.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Unique order identifier' },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'verify_damage_report',
    description: 'Check if a formal damage photo or warehouse inspection report has been verified.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'The order to check verification for' },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'issue_refund',
    description: 'Issue a partial or full monetary refund to the original payment method in cents (amount_cents).',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'The order ID to refund' },
        amount_cents: { type: 'number', description: 'Amount to refund in cents (e.g. 5000 = $50.00)' },
        reason: { type: 'string', description: 'Reason for refund: DAMAGED, DEFECTIVE, LATE, or CUSTOMER_COURTESY' },
      },
      required: ['orderId', 'amount_cents'],
    },
  },
  {
    name: 'add_wallet_credit',
    description: 'Add store credit to the customer wallet for an order in cents (amount_cents).',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID associated with credit' },
        amount_cents: { type: 'number', description: 'Credit amount in cents' },
      },
      required: ['orderId', 'amount_cents'],
    },
  },
  {
    name: 'apply_discount_code',
    description: 'Apply a retention or promotional discount code to an order.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Target order ID' },
        code: { type: 'string', description: 'Promotional discount coupon code' },
      },
      required: ['orderId', 'code'],
    },
  },
  {
    name: 'cancel_order',
    description: 'Cancel an order before it has shipped.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID to cancel' },
      },
      required: ['orderId'],
    },
  },
];
