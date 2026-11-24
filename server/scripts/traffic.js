import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initLaunchDarkly } from '../src/launchdarkly.js';
import { simulateExperimentTraffic } from '../src/traffic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env') });

const visitors = Number(process.argv[2]) || 500;
const ldClient = await initLaunchDarkly();

console.log(`Simulating ${visitors} landing page visitors…`);
const result = await simulateExperimentTraffic(ldClient, { visitors });

const rate = ({ exposed, clicked }) => (exposed ? `${((clicked / exposed) * 100).toFixed(1)}%` : 'n/a');
console.table({
  'New hero (v2)': { ...result.newHero, 'click rate': rate(result.newHero) },
  'Current hero': { ...result.currentHero, 'click rate': rate(result.currentHero) },
});
console.log('Events flushed. Results appear in the experiment within a few minutes,');
console.log('and only count while the experiment iteration is running.');

ldClient.close();
