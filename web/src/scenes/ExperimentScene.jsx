import { useState } from 'react';
import { useFlags } from 'launchdarkly-react-client-sdk';
import { FLAGS, METRIC_KEY } from '../flags.js';
import { firstName } from '../personas.js';
import { api } from '../lib/api.js';
import { useLog } from '../lib/log.jsx';
import LandingHero from '../components/LandingHero.jsx';

export default function ExperimentScene({ persona }) {
  const flags = useFlags();
  const { log } = useLog();
  const isNew = flags[FLAGS.landingHero] ?? false;
  const [clicks, setClicks] = useState(0);
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function simulate(visitors) {
    setBusy(true);
    setError(null);
    try {
      const result = await api('/api/experiment/traffic', { visitors });
      setRun(result);
      log(`Simulated ${visitors} visitors`, 'track', 'exposures and conversions sent from the server SDK');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="scene-header">
        <h1 id="scene-heading">Prove the new page earns more quotes</h1>
        <p className="lede">
          The experiment reuses <code>{FLAGS.landingHero}</code> and measures clicks on the hero’s main button with the
          metric <code>{METRIC_KEY}</code>. Targeted people keep their version; the experiment splits everyone who
          reaches the default rule.
        </p>
      </header>

      <div className="targeting-grid">
        <div className="product-frame">
          <p className="frame-caption">The hero {firstName(persona)} is assigned</p>
          <LandingHero isNew={isNew} onConvert={() => setClicks((n) => n + 1)} />
          <p className="frame-foot">
            {clicks === 0
              ? 'Click the button to send a conversion event. It appears in the console.'
              : `${clicks} conversion ${clicks === 1 ? 'event' : 'events'} sent from this browser.`}
          </p>
        </div>

        <aside className="why">
          <h2 className="panel-title">Generate traffic</h2>
          <p className="panel-text">
            Experiments need volume. This sends synthetic visitors through the server SDK: each one is evaluated
            (an exposure) and some click (a conversion). The new hero is given a higher click rate.
          </p>
          <div className="incident-actions">
            <button className="button-primary" type="button" disabled={busy} onClick={() => simulate(300)}>
              {busy ? 'Sending…' : 'Send 300 visitors'}
            </button>
            <button className="button-secondary" type="button" disabled={busy} onClick={() => simulate(1000)}>
              Send 1,000
            </button>
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          {run && <RunSummary run={run} />}
          <p className="panel-text muted">Events count only while an experiment iteration is running.</p>
        </aside>
      </div>

      <section className="steps" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="panel-title">Set up the experiment in LaunchDarkly</h2>
        <ol>
          <li>Metrics → Create metric: custom conversion, event key <code>{METRIC_KEY}</code>, higher is better. (The bootstrap script does this.)</li>
          <li>Experiments → Create experiment: flag <code>{FLAGS.landingHero}</code>, metric <code>{METRIC_KEY}</code>, randomise by user.</li>
          <li>Audience: the default rule, split 50/50. Control is “Current hero”, treatment is “New hero (v2)”.</li>
          <li>Start the iteration, then send traffic here or with <code>npm run traffic -- 1000</code>.</li>
          <li>Open the experiment’s Results tab. Data appears within a few minutes.</li>
        </ol>
      </section>
    </>
  );
}

function RunSummary({ run }) {
  const pct = ({ exposed, clicked }) => (exposed ? `${((clicked / exposed) * 100).toFixed(1)}%` : 'none');
  const notSplit = run.newHero.exposed === 0;
  return (
    <>
    {notSplit && (
      <p className="hint">Every visitor got the current hero, so the default rule isn’t split yet. Start the experiment iteration in LaunchDarkly, then send traffic again.</p>
    )}
    <table className="run">
      <caption>Last run: {run.visitors.toLocaleString()} visitors</caption>
      <thead>
        <tr><th scope="col">Hero</th><th scope="col">Saw it</th><th scope="col">Clicked</th><th scope="col">Rate</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">New</th><td>{run.newHero.exposed}</td><td>{run.newHero.clicked}</td><td>{pct(run.newHero)}</td></tr>
        <tr><th scope="row">Current</th><td>{run.currentHero.exposed}</td><td>{run.currentHero.clicked}</td><td>{pct(run.currentHero)}</td></tr>
      </tbody>
    </table>
    </>
  );
}
