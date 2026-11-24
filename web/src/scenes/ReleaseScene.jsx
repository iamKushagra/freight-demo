import { useEffect, useRef, useState } from 'react';
import { useFlags, useLDClient } from 'launchdarkly-react-client-sdk';
import { ORIGINS, DESTINATIONS, CONTAINERS } from '../../../shared/lanes.js';
import { FLAGS } from '../flags.js';
import { api, clock } from '../lib/api.js';
import { useLog } from '../lib/log.jsx';
import { firstName } from '../personas.js';

export default function ReleaseScene({ persona }) {
  const flags = useFlags();
  const ldClient = useLDClient();
  const { log } = useLog();
  const enabled = flags[FLAGS.instantQuote] ?? false;

  const [lastChange, setLastChange] = useState(null);
  const [incident, setIncident] = useState(null);
  const incidentRef = useRef(null);
  incidentRef.current = incident;

  useEffect(() => {
    if (!ldClient) return undefined;
    const onFlagChange = async (current, previous) => {
      const at = Date.now();
      setLastChange({ at, current, previous, sinceTrigger: null });
      if (current) return;

      const incident = await api('/api/incident').catch(() => incidentRef.current);
      const firedAt = incident?.triggerFiredAt;
      if (firedAt && at - firedAt < 60_000) {
        const sinceTrigger = at - firedAt;
        setLastChange({ at, current, previous, sinceTrigger });
        log(`Browser hid the instant quote ${sinceTrigger} ms after the trigger fired`, 'good', 'Remediated with no deploy');
      }
    };
    ldClient.on(`change:${FLAGS.instantQuote}`, onFlagChange);
    return () => ldClient.off(`change:${FLAGS.instantQuote}`, onFlagChange);
  }, [ldClient, log]);

  return (
    <>
      <header className="scene-header">
        <h1 id="scene-heading">Release without the risk</h1>
        <p className="lede">
          The instant quote is already deployed, switched off behind <code>{FLAGS.instantQuote}</code>.
          Turn the flag on in LaunchDarkly to release it, and off to roll it back. This page updates
          the moment you do, with no reload and no redeploy.
        </p>
      </header>

      <ListenerBanner enabled={enabled} lastChange={lastChange} />

      <div className="release-grid">
        <div className="product-frame" data-state={enabled ? 'on' : 'off'}>
          <p className="frame-caption">abc-freight.example/quote, as {firstName(persona)} sees it</p>
          {enabled ? <InstantQuote persona={persona} /> : <QuoteRequestForm />}
        </div>
        <IncidentPanel enabled={enabled} incident={incident} setIncident={setIncident} />
      </div>
    </>
  );
}

function ListenerBanner({ enabled, lastChange }) {
  if (!lastChange) {
    return (
      <p className="listener-banner is-waiting" role="status">
        Listening for changes to <code>{FLAGS.instantQuote}</code>. It is <strong>{enabled ? 'ON' : 'OFF'}</strong> right now.
        Toggle it in LaunchDarkly and watch this page.
      </p>
    );
  }
  return (

    <p key={lastChange.at} className={`listener-banner ${lastChange.current ? 'is-on' : 'is-off'}`} role="status">
      Change listener fired at {clock(lastChange.at)}: <code>{FLAGS.instantQuote}</code> is now{' '}
      <strong>{lastChange.current ? 'ON' : 'OFF'}</strong>.{' '}
      {lastChange.sinceTrigger !== null
        ? `Remediated ${lastChange.sinceTrigger} ms after the flag trigger fired.`
        : lastChange.current ? 'Feature released without a deploy.' : 'Rolled back without a deploy.'}
    </p>
  );
}

function InstantQuote({ persona }) {
  const [form, setForm] = useState({ origin: 'Chennai', destination: 'Rotterdam', container: '40ft' });
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function getQuote(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setQuote(await api('/api/quote', { ...form, context: persona.context }));
    } catch (err) {
      setQuote(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="quote" onSubmit={getQuote}>
      <h2 className="quote-title">Instant quote</h2>
      <p className="quote-sub">A live price in seconds, held for 48 hours.</p>
      <div className="quote-fields">
        <label>From<select value={form.origin} onChange={update('origin')}>{ORIGINS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label>To<select value={form.destination} onChange={update('destination')}>{DESTINATIONS.map((d) => <option key={d}>{d}</option>)}</select></label>
        <label>Cargo<select value={form.container} onChange={update('container')}>{CONTAINERS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      </div>
      <button className="button-primary" type="submit" disabled={busy}>{busy ? 'Pricing…' : 'Get instant quote'}</button>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {quote && (
        <div className="quote-result">
          <p className="quote-price">USD {quote.price.toLocaleString()}</p>
          <p>{quote.origin} to {quote.destination}, about {quote.transitDays} days with {quote.carrier}.</p>
        </div>
      )}
    </form>
  );
}

function QuoteRequestForm() {
  const [sent, setSent] = useState(false);
  return (
    <form className="quote legacy" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
      <h2 className="quote-title">Request a quote</h2>
      <p className="quote-sub">Tell us about your shipment and our sales desk will reply within one business day.</p>
      {sent ? (
        <p className="quote-result">Request sent. Expect a reply within one business day.</p>
      ) : (
        <>
          <label>Work email<input type="email" required placeholder="you@company.com" /></label>
          <label>Shipment details<textarea rows={3} placeholder="Origin, destination, cargo and ready date" /></label>
          <button className="button-secondary" type="submit">Send request</button>
        </>
      )}
    </form>
  );
}

function IncidentPanel({ enabled, incident, setIncident }) {
  const { log } = useLog();
  const [error, setError] = useState(null);
  const seen = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = () => api('/api/incident').then((s) => alive && setIncident(s)).catch(() => {});
    load();
    const id = setInterval(load, 600);
    return () => { alive = false; clearInterval(id); };
  }, [setIncident]);

  useEffect(() => {
    const timeline = incident?.timeline ?? [];
    if (timeline.length < seen.current) seen.current = 0;
    timeline.slice(seen.current).forEach((t) => log(t.text, t.tone, 'incident drill', t.at));
    seen.current = timeline.length;
  }, [incident, log]);

  async function start() {
    setError(null);
    try { setIncident(await api('/api/incident/start', {})); } catch (err) { setError(err.message); }
  }
  async function reset() {
    setError(null);
    setIncident(await api('/api/incident/reset', {}));
  }

  const phase = incident?.phase ?? 'idle';
  const rate = Math.round((incident?.errorRate ?? 0) * 100);
  const running = ['degraded', 'triggered', 'awaiting-manual'].includes(phase);

  return (
    <section className="incident" data-phase={phase} aria-labelledby="incident-heading">
      <h2 id="incident-heading" className="panel-title">Incident drill</h2>
      <p className="panel-text">
        Ship a bad build of the instant quote. A watchdog, standing in for your monitoring tool, watches the error rate
        and fires a LaunchDarkly flag trigger when it passes 25%.
      </p>

      <div className="meter" role="img" aria-label={`Error rate ${rate} percent, alert threshold 25 percent`}>
        <div className="meter-fill" style={{ width: `${Math.min(rate, 100)}%` }} />
        <div className="meter-threshold" style={{ left: '25%' }} />
      </div>
      <p className="meter-legend">
        <span>{phase === 'resolved' ? 'Error rate when remediated' : 'Error rate'} <strong>{rate}%</strong></span>
        <span>{incident?.totals ? `${incident.totals.failed} failed of ${incident.totals.ok + incident.totals.failed} requests` : ''}</span>
      </p>

      <div className="incident-actions">
        <button className="button-danger" type="button" onClick={start} disabled={!enabled || running}>
          Ship the bad release
        </button>
        <button className="button-secondary" type="button" onClick={reset} disabled={phase === 'idle'}>
          Reset drill
        </button>
      </div>
      {!enabled && !running && phase !== 'resolved' && (
        <p className="hint">Turn <code>{FLAGS.instantQuote}</code> on first. You can only break a feature that is released.</p>
      )}
      {phase === 'resolved' && (
        <p className="hint">Resolved. To run the drill again, reset it and turn the flag back on in LaunchDarkly.</p>
      )}
      {error && <p className="inline-error" role="alert">{error}</p>}

      {incident?.timeline?.length > 0 && (
        <ol className="timeline">
          {incident.timeline.map((t) => (
            <li key={t.at + t.text} className={`tone-${t.tone}`}>
              <time>{clock(t.at)}</time>
              <span>{t.text}</span>
            </li>
          ))}
        </ol>
      )}

      <details className="curl">
        <summary>Fire the trigger by hand</summary>
        <p>The same remediation from a terminal, or from any tool that can send a webhook:</p>
        <pre><code>curl -X POST "$LD_TRIGGER_URL"</code></pre>
        <p>
          The URL comes from the flag’s Settings → Triggers. {incident?.triggerConfigured
            ? 'It is configured on the server, so the watchdog will fire it for you.'
            : 'It is not set in .env yet, so the watchdog will pause and wait for you.'}
        </p>
      </details>
    </section>
  );
}
