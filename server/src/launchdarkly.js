import { init } from '@launchdarkly/node-server-sdk';

export { FLAGS, METRIC_KEY, AI_CONFIG_KEY } from '../../shared/flags.js';

function sdkKeyOrThrow() {
  const sdkKey = process.env.LD_SDK_KEY;
  if (!sdkKey) {
    throw new Error('LD_SDK_KEY is not set. Copy .env.example to .env and add your SDK key (README → Quick start).');
  }
  return sdkKey;
}

export function createLaunchDarklyClient() {
  const client = init(sdkKeyOrThrow());
  const ready = client.waitForInitialization({ timeout: 10 }).then(() => {
    console.log('[launchdarkly] connected and streaming flag updates');
    return client;
  }).catch((err) => {
    console.error(`[launchdarkly] not initialised yet: ${err.message}`);
    console.error('[launchdarkly] check LD_SDK_KEY and network access; serving fallback values meanwhile');
    return client;
  });
  return { client, ready };
}

export async function initLaunchDarkly() {
  const { ready } = createLaunchDarklyClient();
  return ready;
}

export function toContext(input) {
  if (!input || typeof input !== 'object' || typeof input.key !== 'string') {
    return { kind: 'user', key: 'anonymous-visitor', anonymous: true };
  }
  const { kind = 'user', key, name, email, tier, country, device_type, beta_tester, employee, account_age_days } = input;
  const context = { kind, key, name, email, tier, country, device_type, beta_tester, employee, account_age_days };
  return Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined));
}
