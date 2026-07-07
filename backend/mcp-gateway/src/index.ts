import 'dotenv/config';
import express from 'express';
import { handleMessage } from './gateway.js';
import { discoverTools } from './discovery.js';
import { CATALOG } from './catalog.js';

const app = express();
const PORT = process.env.GATEWAY_PORT ?? 3003;

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mcp-gateway', transport: 'streamable-http' });
});

// GET /catalog — known hosted MCP servers
app.get('/catalog', (_req, res) => {
  res.json(CATALOG);
});

// POST /discover — tool discovery for the dashboard
app.post('/discover', async (req, res) => {
  let { command, args = [], env = {}, url, headers = {} } = req.body as {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    servers?: Record<string, any>;
  };

  // Support nested mcp.json format: { servers: { name: { url, headers } } }
  if (!command && !url && req.body.servers) {
    const first = Object.values(req.body.servers)[0] as any;
    if (first) {
      url = first.url;
      headers = first.headers ?? {};
      command = first.command;
      args = first.args ?? [];
      env = first.env ?? {};
    }
  }

  if (!command && !url) {
    res.status(400).json({ error: 'Either "command" (stdio) or "url" (remote) is required' });
    return;
  }

  try {
    const tools = await discoverTools({ command, args, env, url, headers });
    res.json({ tools });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Discovery failed';
    res.status(500).json({ error: message });
  }
});

// POST /mcp/:token — Streamable HTTP endpoint (single endpoint for all MCP messages)
app.post('/mcp/:token', handleMessage);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🌐 MCP Gateway running on http://localhost:${PORT}`);
  console.log(`   Transport: Streamable HTTP (POST only)`);
  console.log(`   Endpoint:  POST http://localhost:${PORT}/mcp/:token`);
  console.log(`   Discovery: POST http://localhost:${PORT}/discover`);
  console.log(`   Catalog:   GET  http://localhost:${PORT}/catalog`);
});
