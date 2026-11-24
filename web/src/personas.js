export const PERSONAS = [
  {
    id: 'qa-priya',
    role: 'QA engineer at ABC',
    expect: { value: true, why: 'Individual target' },
    context: {
      kind: 'user', key: 'qa-priya', name: 'Priya Raman', email: 'priya.raman@abc-freight.example',
      tier: 'free', country: 'IN', device_type: 'desktop', beta_tester: false, employee: true, account_age_days: 412,
    },
  },
  {
    id: 'qa-marcus',
    role: 'QA lead at ABC',
    expect: { value: true, why: 'Individual target' },
    context: {
      kind: 'user', key: 'qa-marcus', name: 'Marcus Lee', email: 'marcus.lee@abc-freight.example',
      tier: 'pro', country: 'SG', device_type: 'mobile', beta_tester: false, employee: true, account_age_days: 980,
    },
  },
  {
    id: 'ent-aiko',
    role: 'Logistics director, enterprise customer',
    expect: { value: true, why: 'Rule 1: enterprise' },
    context: {
      kind: 'user', key: 'cust-aiko-tanaka', name: 'Aiko Tanaka', email: 'aiko@kitano-electronics.example',
      tier: 'enterprise', country: 'JP', device_type: 'desktop', beta_tester: false, employee: false, account_age_days: 1650,
    },
  },
  {
    id: 'beta-chloe',
    role: 'Pro customer in the beta program',
    expect: { value: true, why: 'Rule 2: beta tester' },
    context: {
      kind: 'user', key: 'cust-chloe-nguyen', name: 'Chloe Nguyen', email: 'chloe@harbourhome.example',
      tier: 'pro', country: 'AU', device_type: 'mobile', beta_tester: true, employee: false, account_age_days: 230,
    },
  },
  {
    id: 'pro-sam',
    role: 'Pro customer, not in the beta',
    expect: { value: false, why: 'Default rule' },
    context: {
      kind: 'user', key: 'cust-sam-patel', name: 'Sam Patel', email: 'sam@patel-textiles.example',
      tier: 'pro', country: 'IN', device_type: 'desktop', beta_tester: false, employee: false, account_age_days: 540,
    },
  },
  {
    id: 'free-dewi',
    role: 'New visitor on the free tier',
    expect: { value: false, why: 'Default rule' },
    context: {
      kind: 'user', key: 'visitor-dewi-s', name: 'Dewi Santoso', email: 'dewi@example.com',
      tier: 'free', country: 'ID', device_type: 'mobile', beta_tester: false, employee: false, account_age_days: 2,
    },
  },
];

export const DEFAULT_PERSONA = PERSONAS.find((p) => p.id === 'pro-sam');

export const firstName = (persona) => persona.context.name.split(' ')[0];
