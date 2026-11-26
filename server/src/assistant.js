import * as aiSdk from '@launchdarkly/server-sdk-ai';
import { AI_CONFIG_KEY } from './launchdarkly.js';
import { complete } from './llm.js';

const FALLBACK_CONFIG = {
  enabled: true,
  model: { name: 'exa' },
  messages: [{
    role: 'system',
    content: 'You are the ABC Freight shipping assistant. Answer briefly and factually.',
  }],
};

let aiClient = null;
let aiInitError = null;
const trackers = new Map();

export function initAssistant(ldClient) {
  try {
    aiClient = aiSdk.initAi(ldClient);
  } catch (err) {
    aiInitError = err;
    console.warn(`[ai-config] AI SDK unavailable, using the in-code fallback config: ${err.message}`);
  }
}

export function assistantStatus() {
  return aiClient ? 'ready' : `unavailable (${aiInitError?.message ?? 'not initialised'})`;
}

async function resolveConfig(context) {
  if (!aiClient) return { config: FALLBACK_CONFIG, tracker: null };

  const variables = {
    customer_name: context.name ?? 'there',
    tier: context.tier ?? 'free',
    country: context.country ?? '',
  };

  const method = typeof aiClient.completionConfig === 'function' ? 'completionConfig' : 'config';
  const result = await aiClient[method](AI_CONFIG_KEY, context, FALLBACK_CONFIG, variables);
  const config = result?.config && !result.messages ? result.config : result;
  const tracker = result?.createTracker?.() ?? result?.tracker ?? null;
  return { config, tracker };
}

export async function chat(context, history) {
  const { config, tracker } = await resolveConfig(context);
  const variation = tracker?.getTrackData?.()?.variationKey || null;
  const source = variation
    ? 'LaunchDarkly AI Config'
    : `in-code fallback (${aiClient ? 'AI Config not found' : 'AI SDK unavailable'})`;

  if (config?.enabled === false) {
    return {
      reply: 'The shipping assistant is switched off right now. Email support@abc-freight.example and the team will reply within one business day.',
      meta: { enabled: false },
    };
  }

  const messages = [...(config.messages ?? []), ...history];
  const started = performance.now();
  try {
    const out = await complete({ model: config.model, messages, context });
    const latencyMs = Math.round(performance.now() - started);

    tracker?.trackDuration?.(latencyMs);
    tracker?.trackSuccess?.();

    const responseId = rememberTracker(tracker);
    return {
      reply: out.text,
      responseId,
      meta: {
        enabled: true,
        model: config.model?.name ?? 'unknown',
        provider: out.provider,
        exaModel: out.exaModel ?? null,
        citations: out.citations ?? [],
        latencyMs,
        costUsd: out.costUsd ?? null,
        variation,
        source,
        systemPrompt: messages.find((m) => m.role === 'system')?.content ?? '',
      },
    };
  } catch (err) {
    tracker?.trackError?.();
    throw err;
  }
}

export function recordFeedback(responseId, positive) {
  const tracker = trackers.get(responseId);
  if (!tracker?.trackFeedback) return false;
  const kind = positive
    ? aiSdk.LDFeedbackKind?.Positive ?? 'positive'
    : aiSdk.LDFeedbackKind?.Negative ?? 'negative';
  tracker.trackFeedback({ kind });
  trackers.delete(responseId);
  return true;
}

let counter = 0;
function rememberTracker(tracker) {
  const id = `r${Date.now().toString(36)}${(counter++).toString(36)}`;
  if (tracker) {
    trackers.set(id, tracker);
    if (trackers.size > 200) trackers.delete(trackers.keys().next().value);
  }
  return id;
}
