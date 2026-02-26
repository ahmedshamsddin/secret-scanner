import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { scansRouter } from './routes/scans.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '4000');

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/scans', scansRouter);

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🔍 Secret Scanner API running on http://localhost:${PORT}`);
});
