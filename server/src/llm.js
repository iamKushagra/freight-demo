const EXA_MODELS = new Set(['exa', 'exa-pro', 'exa-research', 'exa-fast']);

export async function complete({ model, messages, context }) {
  const modelName = model?.name ?? 'exa';
  if (!process.env.EXA_API_KEY) {
    return mockComplete({ modelName, messages, context, reason: 'no EXA_API_KEY' });
  }
  return callExa({ modelName, messages, context });
}

function resolveExaModel(name) {
  const raw = String(name ?? '').toLowerCase();
  return EXA_MODELS.has(raw) ? raw : 'exa';
}

async function callExa({ modelName, messages, context }) {
  const exaModel = resolveExaModel(modelName);
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const query = buildQuery(messages);
  const body = { query, model: exaModel, stream: false };
  if (system) body.systemPrompt = system.slice(0, 4000);
  if (/^[A-Za-z]{2}$/.test(context?.country ?? '')) body.userLocation = context.country;

  const res = await fetch('https://api.exa.ai/answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.EXA_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error?.message || data.message || res.status;
    throw new Error(`Exa: ${message}`);
  }

  const text = typeof data.answer === 'string' ? data.answer : JSON.stringify(data.answer ?? '');
  const citations = (data.citations ?? []).slice(0, 4).map((c) => ({ title: c.title, url: c.url }));
  return {
    text,
    citations,
    exaModel,
    costUsd: data.costDollars?.total ?? null,
    provider: 'Exa',
  };
}

function buildQuery(messages) {
  const turns = messages.filter((m) => m.role !== 'system' && typeof m.content === 'string');
  const latest = [...turns].reverse().find((m) => m.role === 'user')?.content ?? '';
  const earlier = turns.slice(0, -1).slice(-4);
  if (!earlier.length) return latest;
  const prior = earlier.map((m) => `${m.role}: ${m.content}`).join('\n');
  return `Earlier in this conversation:\n${prior}\n\nAnswer this: ${latest}`;
}

const TOPICS = [
  {
    match: /quote|price|cost|rate|how much/i,
    short: 'Use our instant quote for a price held for 48 hours. As a guide, a 40 ft container from Chennai to Rotterdam is about USD 2,400 and takes around 24 days with Maersk.',
    long: 'Use the instant quote: it prices your lane and container size in a few seconds and holds the rate for 48 hours. As a guide, a 40 ft container from Chennai to Rotterdam is about USD 2,400 port to port and takes around 24 days with Maersk, via Suez. For less than a container load (LCL), send a quote request and the sales desk will price it by volume.',
  },
  {
    match: /delay|late|stuck|where|track/i,
    short: 'Your shipment page shows the latest port event. If it is more than 48 hours late, I can open a delay case for you.',
    long: 'Delays usually come from port congestion or a missed vessel cut-off. Your shipment page shows the latest port event and the revised arrival date. If the delay is more than 48 hours, I can open a delay case, which puts a named coordinator on it and checks whether we can move the container to an earlier sailing.',
  },
  {
    match: /customs|duty|document|paperwork|import/i,
    short: 'You need a commercial invoice, a packing list and the bill of lading. Some goods also need a certificate of origin.',
    long: 'Most imports need three documents: a commercial invoice, a packing list and the bill of lading, which we issue. Depending on the goods and the trade agreement, a certificate of origin can lower or remove duty. Australia also asks for a packing declaration covering timber and treatment. Upload them on the shipment page and our customs team checks them before the vessel arrives.',
  },
];
const DEFAULT_TOPIC = {
  short: 'I can help with quotes, tracking and customs paperwork. What are you shipping?',
  long: 'I can help with instant quotes, tracking a shipment, delay cases and customs paperwork. Tell me where you are shipping from and to, and roughly what the cargo is, and I will point you to the fastest option.',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function mockComplete({ modelName, messages, context, reason }) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const topic = TOPICS.find((t) => t.match.test(question)) ?? DEFAULT_TOPIC;

  const concise = /concise|brief|short|one or two sentences/i.test(system);
  const warm = /warm|friendly|empath/i.test(system);
  let text = concise ? topic.short : topic.long;
  if (warm) {
    const firstName = context?.name?.split(' ')[0];
    text = `Happy to help${firstName ? `, ${firstName}` : ''}. ${text}`;
  }
  text += ' Add EXA_API_KEY to search the web with Exa and attach sources.';

  const exaModel = resolveExaModel(modelName);
  await sleep((exaModel === 'exa-fast' ? 350 : 1100) + Math.random() * 400);

  return {
    text,
    citations: [],
    exaModel,
    costUsd: null,
    provider: `local fallback (${reason})`,
  };
}
