import { useCallback, useEffect, useState } from 'react';
import { useFlags, useLDClient } from 'launchdarkly-react-client-sdk';
import { FLAGS, FLAG_LIST } from '../flags.js';
import { PERSONAS, firstName } from '../personas.js';
import { describeReason } from '../lib/reason.js';
import { api } from '../lib/api.js';
import LandingHero from '../components/LandingHero.jsx';

const HERO_RULES = FLAG_LIST.find((f) => f.key === FLAGS.landingHero).rules;

export default function TargetingScene({ persona }) {
  const flags = useFlags();
  const ldClient = useLDClient();
  const isNew = flags[FLAGS.landingHero] ?? false;
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (ldClient) setDetail(ldClient.variationDetail(FLAGS.landingHero, false));
  }, [ldClient, isNew, persona.id]);

  const reason = describeReason(detail?.reason, HERO_RULES);

  return (
    <>
      <header className="scene-header">
        <h1 id="scene-heading">Roll out the new landing page safely</h1>
        <p className="lede">
          Around 40,000 people a day land on this page, so the redesign reaches people in stages. QA sees it first by
          name, then enterprise customers and beta testers by rule. Everyone else keeps today’s page.
        </p>
      </header>

      <div className="targeting-grid">
        <div className="product-frame">
          <p className="frame-caption">abc-freight.example, as {firstName(persona)} sees it</p>
          <LandingHero isNew={isNew} />
        </div>
        <aside className="why">
          <h2 className="panel-title">Why {firstName(persona)} sees the {isNew ? 'new' : 'current'} hero</h2>
          <p className="why-reason">{reason.label}</p>
          <p className="panel-text">{reason.detail}</p>
          <p className="panel-text muted">
            Switch persona in the console to see the same page through someone else’s eyes.
          </p>
        </aside>
      </div>

      <AudienceMatrix persona={persona} />
    </>
  );
}

function AudienceMatrix({ persona }) {
  const [rows, setRows] = useState({});
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/targeting/matrix', {
        personas: PERSONAS.map(({ id, context }) => ({ id, context })),
      });
      setRows(Object.fromEntries(data.rows.map((r) => [r.id, r])));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="matrix" aria-labelledby="matrix-heading">
      <h2 id="matrix-heading" className="panel-title">Who gets the new hero</h2>
      <p className="panel-text">
        Live from the server SDK. Expected values come from the targeting in the README; a mismatch means the
        flag’s targets or rules differ from the setup steps.
      </p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Attributes</th>
              <th scope="col">Expected</th>
              <th scope="col">Served now</th>
              <th scope="col">Because</th>
            </tr>
          </thead>
          <tbody>
            {PERSONAS.map((p) => {
              const row = rows[p.id];
              const served = row?.value;
              const mismatch = row && served !== p.expect.value;
              return (
                <tr key={p.id} aria-current={p.id === persona.id ? 'true' : undefined}>
                  <th scope="row">
                    {p.context.name}
                    <span className="row-sub">{p.role}</span>
                  </th>
                  <td className="attr-cell">
                    {p.context.tier}, {p.context.country}, {p.context.device_type}
                    {p.context.beta_tester && ', beta'}
                    {p.context.employee && ', employee'}
                  </td>
                  <td>{p.expect.value ? 'New' : 'Current'} <span className="row-sub">{p.expect.why}</span></td>
                  <td>
                    {row ? (
                      <span className={`flag-pill ${served ? 'is-on' : 'is-off'}`}>{served ? 'New' : 'Current'}</span>
                    ) : '…'}
                    {mismatch && <span className="mismatch" title="Differs from the expected setup">check setup</span>}
                  </td>
                  <td>{row ? describeReason(row.reason, HERO_RULES).label : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
