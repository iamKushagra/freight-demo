import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

import { FLAGS, createLaunchDarklyClient, toContext } from './launchdarkly.js';
import { createIncidentSimulator, SIMULATED_FAILURE_RATE } from './incident.js';
import { priceQuote } from './quotes.js';
import { simulateExperimentTraffic } from './traffic.js';
import { assistantStatus, chat, initAssistant, recordFeedback } from './assistant.js';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env') });

const { client: ldClient } = createLaunchDarklyClient();
const incident = createIncidentSimulator({ ldClient, flagKey: FLAGS.instantQuote });
initAssistant(ldClient);

const app = express();
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    launchDarkly: ldClient.initialized() ? 'connected' : 'not connected',
    triggerConfigured: Boolean(process.env.LD_TRIGGER_URL),
    aiSdk: assistantStatus(),
    llm: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY ? 'real model available' : 'mock LLM',
  });
});

app.post('/api/quote', async (req, res) => {
  const context = toContext(req.body.context);

  const enabled = await ldClient.variation(FLAGS.instantQuote, context, false);
  if (!enabled) {
    return res.status(404).json({ error: 'Instant quotes are not available for this account yet.' });
  }

  if (incident.isDegraded() && Math.random() < SIMULATED_FAILURE_RATE) {
    return res.status(503).json({ error: 'The pricing service timed out (release 2.4.1 incident). Try again, or use the request form.' });
  }

  try {
    res.json(priceQuote(req.body));
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.get('/api/incident', (_req, res) => res.json(incident.snapshot()));

app.post('/api/incident/start', async (_req, res) => {
  const result = await incident.start();
  res.status(result.ok ? 200 : 409).json({ ...result, ...incident.snapshot() });
});

app.post('/api/incident/reset', (_req, res) => {
  incident.reset();
  res.json(incident.snapshot());
});

app.post('/api/targeting/matrix', async (req, res) => {
  const personas = Array.isArray(req.body.personas) ? req.body.personas.slice(0, 20) : [];

  const rows = await Promise.all(personas.map(async ({ id, context }) => {
    const state = await ldClient.allFlagsState(toContext(context), { withReasons: true });
    return {
      id,
      value: state.getFlagValue(FLAGS.landingHero) ?? null,
      reason: state.getFlagReason(FLAGS.landingHero) ?? null,
    };
  }));
  res.json({ flag: FLAGS.landingHero, rows });
});

app.post('/api/experiment/traffic', async (req, res) => {
  const visitors = Math.min(Math.max(Number(req.body.visitors) || 300, 10), 2000);
  res.json(await simulateExperimentTraffic(ldClient, { visitors }));
});

app.post('/api/chat', async (req, res) => {
  const context = toContext(req.body.context);
  const history = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter((m) => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string')
    .slice(-10);
  if (!history.length || history.at(-1).role !== 'user') {
    return res.status(400).json({ error: 'Send at least one user message.' });
  }
  try {
    res.json(await chat(context, history));
  } catch (err) {
    console.error('[chat]', err);
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/chat/feedback', (req, res) => {
  res.json({ recorded: recordFeedback(req.body.responseId, Boolean(req.body.positive)) });
});

const port = Number(process.env.PORT) || 3001;
const server = app.listen(port, () => console.log(`[server] API listening on http://localhost:${port}`));

async function shutdown() {
  server.close();
  try { await ldClient.flush(); } finally { ldClient.close(); process.exit(0); }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
