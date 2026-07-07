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

app.use('/api/posts', postsRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`📝  Dummy app running on http://localhost:${PORT}`);
});
