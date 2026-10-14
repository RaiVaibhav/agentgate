import 'dotenv/config';
import express from 'express';
import postsRouter from './routes/posts';

const app = express();
const PORT = process.env.DUMMY_APP_PORT ?? 3002;

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dummy-app' });
});

// Mock remote MCP server endpoint for E2E testing
app.post('/mcp', (req, res) => {
  const { id, method, params } = req.body ?? {};
  if (method === 'tools/list') {
    res.json({
      jsonrpc: '2.0',
      id: id ?? 1,
      result: {
        tools: [
          { name: 'read_file', description: 'Read a file from disk', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
          { name: 'write_file', description: 'Write content to a file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } },
          { name: 'delete_file', description: 'Delete a file', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
          { name: 'list_directory', description: 'List files in directory', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
        ],
      },
    });
    return;
  }
  if (method === 'tools/call') {
    res.json({
      jsonrpc: '2.0',
      id: id ?? 1,
      result: {
        content: [{ type: 'text', text: `Mock execution of ${params?.name} completed successfully.` }],
        isError: false,
      },
    });
    return;
  }
  res.json({ jsonrpc: '2.0', id: id ?? 1, result: {} });
});

app.use('/api/posts', postsRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`📝  Dummy app running on http://localhost:${PORT}`);
});
