export async function complete({ model, provider, messages, context }) {
  const modelName = model?.name ?? 'fallback-mock';
  const params = model?.parameters ?? {};
  const vendor = String(provider?.name ?? inferVendor(modelName)).toLowerCase();

  if (vendor.includes('openai')) {
    if (process.env.OPENAI_API_KEY) return callOpenAI(modelName, params, messages);
    return mockComplete({ modelName, messages, context, reason: 'no OPENAI_API_KEY' });
  }
  if (vendor.includes('anthropic')) {
    if (process.env.ANTHROPIC_API_KEY) return callAnthropic(modelName, params, messages);
    return mockComplete({ modelName, messages, context, reason: 'no ANTHROPIC_API_KEY' });
  }
  return mockComplete({ modelName, messages, context, reason: 'mock model selected' });
}

function inferVendor(name) {
  if (/^claude/i.test(name)) return 'anthropic';
  if (/^(gpt|o\d|chatgpt)/i.test(name)) return 'openai';
  return 'mock';
}

const maxTokensOf = (params) => params.maxTokens ?? params.max_tokens ?? 500;

async function callOpenAI(model, params, messages) {
  const body = { model, messages, max_completion_tokens: maxTokensOf(params) };
  if (params.temperature !== undefined) body.temperature = params.temperature;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI: ${data.error?.message ?? res.status}`);
  const u = data.usage ?? {};
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    usage: { input: u.prompt_tokens ?? 0, output: u.completion_tokens ?? 0, total: u.total_tokens ?? 0 },
    provider: 'openai',
    mocked: false,
  };
}

async function callAnthropic(model, params, messages) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns = messages.filter((m) => m.role !== 'system');
  const body = { model, system, messages: turns, max_tokens: maxTokensOf(params) };
  if (params.temperature !== undefined) body.temperature = params.temperature;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic: ${data.error?.message ?? res.status}`);
  const u = data.usage ?? {};
  return {
    text: (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
    usage: { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, total: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) },
    provider: 'anthropic',
    mocked: false,
  };
}

const TOPICS = [
  {
    match: /quote|price|cost|rate|how much/i,
    short: 'Use our instant quote for a live price. As a guide, a 40ft container from Chennai to Rotterdam is about USD 4,500 and takes around 18 days.',
    long: 'For a live price, use the instant quote. It prices the lane, container size and carrier in a few seconds and holds the rate for 48 hours. As a guide, a 40ft container from Chennai to Rotterdam runs about USD 4,500 with roughly 18 days at sea plus port handling. If your cargo is under about 15 cubic metres, a shared (LCL) container is usually cheaper.',
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
const estimateTokens = (text) => Math.ceil(text.length / 4);

async function mockComplete({ modelName, messages, context, reason }) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const topic = TOPICS.find((t) => t.match.test(question)) ?? DEFAULT_TOPIC;

  const concise = /concise|brief|short|one or two sentences/i.test(system);
  const warm = /warm|friendly|white-glove|empath/i.test(system);
  let text = concise ? topic.short : topic.long;
  if (warm) {
    const firstName = context?.name?.split(' ')[0];
    text = `Happy to help${firstName ? `, ${firstName}` : ''}. ${text}`;
  }
  if (/enterprise/i.test(system) && context?.tier === 'enterprise') {
    text += ' As an enterprise customer, you can also reach your account manager directly.';
  }

  const fast = /mini|haiku|flash|small|nano/i.test(modelName);
  await sleep((fast ? 350 : 1100) + Math.random() * 400);

  const input = estimateTokens(messages.map((m) => m.content).join(' '));
  const output = estimateTokens(text);
  return { text, usage: { input, output, total: input + output }, provider: `mock (${reason})`, mocked: true };
}
