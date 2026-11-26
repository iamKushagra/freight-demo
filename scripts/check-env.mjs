import { ensureEnvFile, readEnv } from './env-file.mjs';

const ok = (msg) => console.log(`  \u2713 ${msg}`);
const warn = (msg) => console.log(`  ! ${msg}`);
const fail = (msg) => console.log(`  \u2717 ${msg}`);

console.log('\nABC Freight demo: checking your setup\n');

let blocking = 0;

const [major] = process.versions.node.split('.').map(Number);
if (major >= 20) ok(`Node.js ${process.versions.node}`);
else { fail(`Node.js ${process.versions.node} found; this demo needs Node 20 or newer.`); blocking++; }

if (ensureEnvFile()) {
  warn('Created .env from .env.example. Fill in your LaunchDarkly keys, or run `npm run bootstrap`.');
}
const env = readEnv();

if (/^sdk-[\w-]+$/.test(env.LD_SDK_KEY ?? '')) ok('LD_SDK_KEY looks like a server-side SDK key');
else { fail('LD_SDK_KEY is missing or does not start with "sdk-". See .env.example.'); blocking++; }

if (/^[a-f0-9]{24}$/i.test(env.VITE_LD_CLIENT_SIDE_ID ?? '')) ok('VITE_LD_CLIENT_SIDE_ID looks like a client-side ID');
else { fail('VITE_LD_CLIENT_SIDE_ID is missing or is not a 24-character client-side ID. See .env.example.'); blocking++; }

if (env.LD_TRIGGER_URL) ok('LD_TRIGGER_URL is set, so the watchdog can remediate automatically');
else warn('LD_TRIGGER_URL is empty. The incident demo still runs; you will turn the flag off by hand.');

if (env.EXA_API_KEY) ok('EXA_API_KEY is set; the assistant answers with Exa and cites sources');
else warn('EXA_API_KEY is empty. The assistant uses the local fallback (fine for the demo).');

if (blocking) {
  console.log(`\n${blocking} problem(s) need fixing before the app can start. Details: README → Quick start.\n`);
  process.exit(1);
}
console.log('\nAll set. Starting the app…\n');
