const TICK_MS = 200;
const WINDOW = 20;
const MIN_SAMPLES = 10;
const THRESHOLD = 0.25;
export const SIMULATED_FAILURE_RATE = 0.6;
const MAX_RUN_MS = 90_000;

export function createIncidentSimulator({ ldClient, flagKey }) {
  const watchdogContext = { kind: 'user', key: 'ops-watchdog', name: 'Ops watchdog' };

  let state = freshState();
  let timer = null;
  let failuresInWindow = 0;

  function freshState() {
    return {
      phase: 'idle',
      startedAt: null,
      window: [],
      totals: { ok: 0, failed: 0 },
      triggerFiredAt: null,
      resolvedAt: null,
      timeline: [],
    };
  }

  const note = (text, tone = 'info') => state.timeline.push({ at: Date.now(), text, tone });
  const errorRate = () => (state.window.length ? failuresInWindow / state.window.length : 0);
  const isActive = () => ['degraded', 'triggered', 'awaiting-manual'].includes(state.phase);

  async function flagIsOn() {
    return ldClient.variation(flagKey, watchdogContext, false);
  }

  function stopTraffic() {
    clearInterval(timer);
    timer = null;
  }

  async function fireTrigger() {
    const url = process.env.LD_TRIGGER_URL;
    const rate = Math.round(errorRate() * 100);

    if (!url) {
      state.phase = 'awaiting-manual';
      note(`Error rate hit ${rate}%, above the 25% threshold. No trigger URL is configured, so remediate by hand: run the curl command or turn the flag off in LaunchDarkly.`, 'alert');
      return;
    }

    state.phase = 'triggered';
    state.triggerFiredAt = Date.now();
    note(`Error rate hit ${rate}%, above the 25% threshold. Watchdog fired the LaunchDarkly flag trigger.`, 'alert');
    try {
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) note('LaunchDarkly accepted the trigger. Waiting for the flag change to stream back…');
      else note(`The trigger URL answered HTTP ${res.status}. Check that it is current (Triggers → reset URL) and enabled.`, 'warn');
    } catch (err) {
      note(`Could not reach the trigger URL: ${err.message}`, 'warn');
    }
  }

  function tick() {
    if (Date.now() - state.startedAt > MAX_RUN_MS) {
      note('Simulation stopped after 90 seconds without remediation.', 'warn');
      stopTraffic();
      return;
    }
    const success = Math.random() > SIMULATED_FAILURE_RATE;
    state.window.push(success);
    if (!success) failuresInWindow += 1;
    if (state.window.length > WINDOW) {
      const dropped = state.window.shift();
      if (!dropped) failuresInWindow -= 1;
    }
    state.totals[success ? 'ok' : 'failed'] += 1;

    if (state.phase === 'degraded' && state.window.length >= MIN_SAMPLES && errorRate() > THRESHOLD) {
      fireTrigger();
    }
  }

  ldClient.on(`update:${flagKey}`, async () => {
    if (!isActive()) return;
    if (await flagIsOn()) return;
    stopTraffic();
    state.phase = 'resolved';
    state.resolvedAt = Date.now();
    const after = state.triggerFiredAt ? ` ${state.resolvedAt - state.triggerFiredAt} ms after the trigger fired` : '';
    note(`Server received ${flagKey} = OFF over the streaming connection${after}. Quote traffic falls back to the legacy form; errors stop.`, 'good');
  });

  return {
    async start() {
      if (isActive()) return { ok: false, error: 'An incident is already running. Reset it first.' };
      if (!(await flagIsOn())) {
        return { ok: false, error: `Turn ${flagKey} ON in LaunchDarkly first: you can only break a feature that is released.` };
      }
      state = freshState();
      failuresInWindow = 0;
      state.phase = 'degraded';
      state.startedAt = Date.now();
      note('Release 2.4.1 is live. A pricing-service bug starts failing instant quote requests.', 'alert');
      timer = setInterval(tick, TICK_MS);
      return { ok: true };
    },

    reset() {
      stopTraffic();
      state = freshState();
      failuresInWindow = 0;
    },

    isDegraded: () => isActive(),

    snapshot() {
      return {
        phase: state.phase,
        errorRate: errorRate(),
        threshold: THRESHOLD,
        totals: state.totals,
        startedAt: state.startedAt,
        triggerFiredAt: state.triggerFiredAt,
        resolvedAt: state.resolvedAt,
        timeline: state.timeline,
        triggerConfigured: Boolean(process.env.LD_TRIGGER_URL),
      };
    },
  };
}
