import { FLAGS, METRIC_KEY, AI_CONFIG_KEY } from '../../shared/flags.js';

export { FLAGS, METRIC_KEY, AI_CONFIG_KEY };

export const FLAG_LIST = [
  {
    key: FLAGS.instantQuote,
    fallback: false,
    describe: (value) => (value ? 'Instant quote' : 'Quote request form'),
  },
  {
    key: FLAGS.landingHero,
    fallback: false,
    describe: (value) => (value ? 'New hero' : 'Current hero'),
    rules: ['tier is enterprise', 'beta_tester is true'],
  },
];
