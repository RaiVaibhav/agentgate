import 'dotenv/config';
import express from 'express';
import agentsRouter from './routes/agents.js';
import sessionsRouter from './routes/sessions.js';
import auditRouter from './routes/audit.js';
import servicesRouter from './routes/services.js';

const app = express();
const PORT = process.env.PROXY_PORT ?? 3001;

app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'agent-permission-proxy' });
});

app.use('/agents', agentsRouter);
app.use('/sessions', sessionsRouter);
app.use('/services', servicesRouter);
app.use('/audit', auditRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🛡️  Proxy running on http://localhost:${PORT}`);
});
