import { FLAGS, METRIC_KEY } from './launchdarkly.js';

const CLICK_RATE = { true: 0.16, false: 0.1 };
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export async function simulateExperimentTraffic(ldClient, { visitors = 300 } = {}) {
  const runId = Date.now().toString(36);
  const tally = { true: { exposed: 0, clicked: 0 }, false: { exposed: 0, clicked: 0 } };

  const visit = async (i) => {
    const context = {
      kind: 'user',
      key: `sim-${runId}-${i}`,
      name: `Simulated visitor ${i + 1}`,
      tier: pick(['free', 'free', 'free', 'pro']),
      country: pick(['IN', 'SG', 'AU', 'JP', 'ID', 'VN']),
      device_type: pick(['mobile', 'mobile', 'desktop']),
      beta_tester: false,
      employee: false,
      simulated: true,
    };
    const sawNewHero = await ldClient.variation(FLAGS.landingHero, context, false);
    const bucket = tally[String(sawNewHero)];
    bucket.exposed += 1;
    if (Math.random() < CLICK_RATE[sawNewHero]) {
      ldClient.track(METRIC_KEY, context);
      bucket.clicked += 1;
    }
  };

  const BATCH = 40;
  for (let start = 0; start < visitors; start += BATCH) {
    const jobs = [];
    for (let i = start; i < Math.min(visitors, start + BATCH); i += 1) jobs.push(visit(i));
    await Promise.all(jobs);
  }

  await ldClient.flush();
  return {
    runId,
    visitors,
    newHero: tally.true,
    currentHero: tally.false,
  };
}
