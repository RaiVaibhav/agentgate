/**
 * Catalog of known hosted MCP servers.
 * All support Streamable HTTP — no npx, no spawn needed.
 * User just provides their auth token.
 */

export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  url: string;
  authType: 'bearer' | 'oauth' | 'none';
  authLabel?: string;
  authPlaceholder?: string;
  oauthNote?: string;
  docsUrl: string;
};

export const CATALOG: CatalogEntry[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repositories, issues, pull requests, code search, actions',
    url: 'https://api.githubcopilot.com/mcp/',
    authType: 'bearer',
    authLabel: 'GitHub Personal Access Token',
    authPlaceholder: 'github_pat_...',
    docsUrl: 'https://github.com/github/github-mcp-server',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payments, customers, refunds, subscriptions',
    url: 'https://mcp.stripe.com',
    authType: 'bearer',
    authLabel: 'Stripe Restricted Key',
    authPlaceholder: 'rk_test_...',
    docsUrl: 'https://docs.stripe.com/mcp',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Channels, messages, users, reactions',
    url: 'https://mcp.slack.com/mcp',
    authType: 'bearer',
    authLabel: 'Slack Bot Token',
    authPlaceholder: 'xoxb-...',
    docsUrl: 'https://docs.slack.com',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    description: 'DNS, Workers, R2, KV, D1',
    url: 'https://mcp.cloudflare.com',
    authType: 'oauth',
    oauthNote: 'Cloudflare uses OAuth. Authorize via Cloudflare after connecting.',
    docsUrl: 'https://developers.cloudflare.com/mcp',
  },
];
