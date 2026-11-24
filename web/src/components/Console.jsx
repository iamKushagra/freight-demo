import { useEffect, useState } from 'react';
import { useFlags, useLDClient } from 'launchdarkly-react-client-sdk';
import { FLAG_LIST } from '../flags.js';
import { PERSONAS, firstName } from '../personas.js';
import { describeReason } from '../lib/reason.js';
import { api, clock } from '../lib/api.js';
import { useLog } from '../lib/log.jsx';

export default function Console({ persona, onSwitchPersona }) {
  return (
    <aside className="console" aria-label="Demo console">
      <PersonaPicker persona={persona} onSwitch={onSwitchPersona} />
      <FlagBoard persona={persona} />
      <EventLog />
      <Health />
    </aside>
  );
}

function PersonaPicker({ persona, onSwitch }) {
  const c = persona.context;
  return (
    <section className="console-block">
      <h2 className="console-heading">Viewing as</h2>
      <label className="visually-hidden" htmlFor="persona">Choose a persona</label>
      <select id="persona" className="persona-select" value={persona.id} onChange={(e) => onSwitch(e.target.value)}>
        {PERSONAS.map((p) => (
          <option key={p.id} value={p.id}>{p.context.name}</option>
        ))}
      </select>
      <p className="persona-role">{persona.role}</p>
      <dl className="attrs">
        <div><dt>key</dt><dd>{c.key}</dd></div>
        <div><dt>tier</dt><dd>{c.tier}</dd></div>
        <div><dt>country</dt><dd>{c.country}</dd></div>
        <div><dt>device_type</dt><dd>{c.device_type}</dd></div>
        <div><dt>beta_tester</dt><dd>{String(c.beta_tester)}</dd></div>
        <div><dt>employee</dt><dd>{String(c.employee)}</dd></div>
      </dl>
    </section>
  );
}

function FlagBoard({ persona }) {
  const flags = useFlags();
  const ldClient = useLDClient();
  const [details, setDetails] = useState({});

  const signature = FLAG_LIST.map((f) => String(flags[f.key])).join('|');

  useEffect(() => {
    if (!ldClient) return;
    const next = {};
    for (const f of FLAG_LIST) next[f.key] = ldClient.variationDetail(f.key, f.fallback);
    setDetails(next);
  }, [ldClient, signature, persona.id]);

  return (
    <section className="console-block">
      <h2 className="console-heading">Flags for {firstName(persona)}</h2>
      <ul className="flag-board">
        {FLAG_LIST.map((f) => {
          const value = flags[f.key] ?? f.fallback;
          const reason = describeReason(details[f.key]?.reason, f.rules);
          return (
            <li key={f.key} className="flag-row">
              <code className="flag-key">{f.key}</code>

              <span key={String(value)} className={`flag-pill ${value ? 'is-on' : 'is-off'}`}>
                {value ? 'true' : 'false'}
              </span>
              <span className="flag-serves">{f.describe(value)}</span>
              <span className="flag-reason" title={reason.detail}>{reason.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EventLog() {
  const { entries, clear } = useLog();
  return (
    <section className="console-block console-log">
      <div className="console-heading-row">
        <h2 className="console-heading">Live events</h2>
        {entries.length > 0 && <button type="button" className="text-button" onClick={clear}>Clear</button>}
      </div>
      {entries.length === 0 ? (
        <p className="log-empty">Change a flag in LaunchDarkly or switch persona. Each update appears here as it arrives.</p>
      ) : (
        <ol className="log" aria-live="polite">
          {entries.map((e) => (
            <li key={e.id} className={`log-entry tone-${e.tone}`}>
              <time>{clock(e.at)}</time>
              <span className="log-text">{e.text}</span>
              {e.detail && <span className="log-detail">{e.detail}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Health() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api('/api/health').then(setHealth).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="health health-bad">{error}</p>;
  if (!health) return null;
  return (
    <dl className="health">
      <div><dt>Server SDK</dt><dd>{health.launchDarkly}</dd></div>
      <div><dt>Flag trigger</dt><dd>{health.triggerConfigured ? 'configured' : 'not set (manual curl)'}</dd></div>
      <div><dt>AI SDK</dt><dd>{health.aiSdk}</dd></div>
      <div><dt>LLM</dt><dd>{health.llm}</dd></div>
    </dl>
  );
}
