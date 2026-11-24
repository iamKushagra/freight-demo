import { AI_CONFIG_KEY, FLAGS, METRIC_KEY } from '../shared/flags.js';
import { ensureEnvFile, readEnv, writeEnvValue } from './env-file.mjs';

ensureEnvFile();
const env = readEnv();
const TOKEN = env.LD_API_TOKEN;
const PROJECT = env.LD_PROJECT_KEY || 'default';
const ENVIRONMENT = env.LD_ENVIRONMENT_KEY || 'production';
const BASE = `${(env.LD_API_BASE || 'https://app.launchdarkly.com').replace(/\/$/, '')}/api/v2`;

const step = (msg) => console.log(`\n\u25B8 ${msg}`);
const done = (msg) => console.log(`  \u2713 ${msg}`);
const skip = (msg) => console.log(`  \u2013 ${msg}`);
const warn = (msg) => console.log(`  ! ${msg}`);

if (!TOKEN) {
  console.error('\nLD_API_TOKEN is empty in .env.');
  console.error('Create one under LaunchDarkly → Account settings → Authorization (role: Writer), paste it into .env, and run this again.');
  console.error('Prefer clicking through the UI? Follow README → "Option B: manual setup" instead.\n');
  process.exit(1);
}

async function api(method, path, body, contentType = 'application/json') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: TOKEN, 'Content-Type': contentType },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  return { status: res.status, ok: res.ok, data };
}

function explain(res) {
  const msg = res.data?.message || res.data?.code || JSON.stringify(res.data);
  if (res.status === 401) return `HTTP 401: the API token was rejected. Check LD_API_TOKEN. (${msg})`;
  if (res.status === 403) return `HTTP 403: the token lacks permission. Use a token with the Writer role. (${msg})`;
  if (res.status === 404) return `HTTP 404: not found. Check LD_PROJECT_KEY="${PROJECT}" and LD_ENVIRONMENT_KEY="${ENVIRONMENT}". (${msg})`;
  return `HTTP ${res.status}: ${msg}`;
}

const FLAG_SPECS = [
  {
    key: FLAGS.instantQuote,
    name: 'Instant quote',
    description: 'Part 1: Release & remediate. ON serves the new instant quote widget; OFF serves the legacy quote request form. A generic trigger turns it off during incidents.',
    variations: [
      { value: true, name: 'Instant quote (new)' },
      { value: false, name: 'Quote request form (legacy)' },
    ],

    defaults: { onVariation: 0, offVariation: 1 },
  },
  {
    key: FLAGS.landingHero,
    name: 'Landing page hero v2',
    description: 'Part 2: Targeting, plus the experiment flag. Controls who sees the redesigned landing page hero.',
    variations: [
      { value: true, name: 'New hero (v2)' },
      { value: false, name: 'Current hero' },
    ],

    defaults: { onVariation: 1, offVariation: 1 },
  },
];

async function main() {
  console.log(`\nBootstrapping project "${PROJECT}", environment "${ENVIRONMENT}" at ${BASE}`);

  step('Reading SDK key and client-side ID for the environment');
  const envRes = await api('GET', `/projects/${PROJECT}/environments/${ENVIRONMENT}`);
  if (!envRes.ok) throw new Error(explain(envRes));
  for (const [envKey, value, label] of [
    ['LD_SDK_KEY', envRes.data.apiKey, 'SDK key'],
    ['VITE_LD_CLIENT_SIDE_ID', envRes.data._id, 'client-side ID'],
  ]) {
    if (!value) { warn(`The API did not return the ${label}; copy it from the UI into ${envKey}.`); continue; }
    if (env[envKey] && env[envKey] !== value) {
      warn(`${envKey} in .env belongs to a different environment. Replacing it so keys and flags match.`);
    }
    writeEnvValue(envKey, value);
    done(`${envKey} saved to .env`);
  }

  for (const spec of FLAG_SPECS) {
    step(`Flag ${spec.key}`);
    const created = await api('POST', `/flags/${PROJECT}`, {
      key: spec.key,
      name: spec.name,
      description: spec.description,
      variations: spec.variations,
      defaults: spec.defaults,
      temporary: true,
      tags: ['abc-freight-demo'],

      clientSideAvailability: { usingEnvironmentId: true, usingMobileKey: false },
    });
    if (created.ok) done('created (client-side availability on)');
    else if (created.status === 409) skip('already exists, leaving it as is');
    else throw new Error(explain(created));
  }

  step(`Targeting for ${FLAGS.landingHero}`);
  const hero = await api('GET', `/flags/${PROJECT}/${FLAGS.landingHero}?env=${ENVIRONMENT}`);
  if (!hero.ok) throw new Error(explain(hero));
  const heroEnv = hero.data.environments?.[ENVIRONMENT] ?? {};
  const alreadyTargeted = (heroEnv.rules?.length ?? 0) + (heroEnv.targets?.length ?? 0) + (heroEnv.contextTargets?.length ?? 0) > 0;
  if (alreadyTargeted) {
    skip('targets or rules already exist, leaving them as is');
  } else {
    const on = hero.data.variations.find((v) => v.value === true)?._id;
    const off = hero.data.variations.find((v) => v.value === false)?._id;
    const patch = await api('PATCH', `/flags/${PROJECT}/${FLAGS.landingHero}`, {
      environmentKey: ENVIRONMENT,
      comment: 'ABC Freight demo bootstrap: QA first, then enterprise and beta customers',
      instructions: [
        { kind: 'addTargets', contextKind: 'user', variationId: on, values: ['qa-priya', 'qa-marcus'] },
        {
          kind: 'addRule', description: 'Enterprise customers', variationId: on,
          clauses: [{ contextKind: 'user', attribute: 'tier', op: 'in', negate: false, values: ['enterprise'] }],
        },
        {
          kind: 'addRule', description: 'Beta program members', variationId: on,
          clauses: [{ contextKind: 'user', attribute: 'beta_tester', op: 'in', negate: false, values: [true] }],
        },
        { kind: 'updateFallthroughVariationOrRollout', variationId: off },
        { kind: 'turnFlagOn' },
      ],
    }, 'application/json; domain-model=launchdarkly.semanticpatch');
    if (!patch.ok) throw new Error(explain(patch));
    done('2 individual targets, 2 rules, default rule serves the current hero, flag ON');
  }

  step(`Flag trigger for ${FLAGS.instantQuote}`);
  if (env.LD_TRIGGER_URL) {
    skip('LD_TRIGGER_URL is already set in .env, not creating another trigger');
  } else {
    const trigger = await api('POST', `/flags/${PROJECT}/${FLAGS.instantQuote}/triggers/${ENVIRONMENT}`, {
      comment: 'ABC Freight watchdog: turn instant-quote OFF when the error rate breaches threshold',
      integrationKey: 'generic-trigger',
      instructions: [{ kind: 'turnFlagOff' }],
    });
    if (!trigger.ok) {
      warn(`Could not create the trigger (${explain(trigger)}). Create it in the UI; see README.`);
    } else if (!trigger.data?.triggerURL) {
      warn('Trigger created, but the API did not return its URL. Reset the URL in the UI and paste it into LD_TRIGGER_URL.');
    } else {
      writeEnvValue('LD_TRIGGER_URL', trigger.data.triggerURL);
      done('generic trigger created (action: turn flag off); URL saved to LD_TRIGGER_URL');
    }
  }

  step(`Metric ${METRIC_KEY}`);
  const metric = await api('POST', `/metrics/${PROJECT}`, {
    key: METRIC_KEY,
    name: 'Landing hero CTA click',
    description: 'Visitor clicked the primary call to action in the landing page hero.',
    kind: 'custom',
    eventKey: METRIC_KEY,
    isNumeric: false,
    successCriteria: 'HigherThanBaseline',
    randomizationUnits: ['user'],
    tags: ['abc-freight-demo'],
  });
  if (metric.ok) done('created (custom conversion, higher is better)');
  else if (metric.status === 409) skip('already exists');
  else warn(`Could not create the metric (${explain(metric)}). Create it in the UI; see README.`);

  console.log(`
Done. Two steps stay manual because they are best shown in the UI:
  • Experiment on ${FLAGS.landingHero} using metric ${METRIC_KEY}   (README → Extra credit A)
  • AI Config "${AI_CONFIG_KEY}"                               (README → Extra credit B)

Next: npm run dev, then open http://localhost:5173
Remember: ${FLAGS.instantQuote} starts OFF. Turning it ON in LaunchDarkly is your first demo moment.
`);
}

main().catch((err) => {
  console.error(`\n\u2717 Bootstrap stopped: ${err.message}\n`);
  process.exit(1);
});
