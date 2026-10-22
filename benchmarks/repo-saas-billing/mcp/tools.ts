/**
 * MCP Tools for B2B SaaS Subscription Operations.
 */

export const SAAS_TOOLS = [
  {
    name: 'get_subscription',
    description: 'Fetch details for a B2B subscription including customerId, status, and lastInvoiceCents.',
    inputSchema: {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'Unique subscription ID' },
      },
      required: ['subscriptionId'],
    },
  },
  {
    name: 'issue_invoice_credit',
    description: 'Credit an invoice for an active subscription in cents (amount_cents). Credit cannot exceed last invoice total.',
    inputSchema: {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'Target subscription' },
        amount_cents: { type: 'number', description: 'Credit amount in cents' },
      },
      required: ['subscriptionId', 'amount_cents'],
    },
  },
  {
    name: 'cancel_subscription',
    description: 'Cancel a customer subscription immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'Subscription ID to cancel' },
        reason: { type: 'string', description: 'Cancellation reason' },
      },
      required: ['subscriptionId'],
    },
  },
  {
    name: 'extend_trial',
    description: 'Extend a trial subscription by a number of days.',
    inputSchema: {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'Target subscription' },
        days: { type: 'number', description: 'Number of extra trial days' },
      },
      required: ['subscriptionId', 'days'],
    },
  },
  {
    name: 'apply_retention_coupon',
    description: 'Apply a retention percentage or fixed coupon to prevent cancellation.',
    inputSchema: {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'Target subscription' },
        couponCode: { type: 'string', description: 'Retention coupon code' },
      },
      required: ['subscriptionId', 'couponCode'],
    },
  },
];
