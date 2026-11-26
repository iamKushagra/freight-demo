import { useEffect, useState } from 'react';
import { useLDClient } from 'launchdarkly-react-client-sdk';
import { METRIC_KEY } from '../flags.js';
import { useLog } from '../lib/log.jsx';

export default function LandingHero({ isNew }) {
  const ldClient = useLDClient();
  const { log } = useLog();
  const [clicks, setClicks] = useState(0);
  const which = isNew ? 'new' : 'current';

  useEffect(() => { setClicks(0); }, [isNew]);

  function handleCta() {
    ldClient?.track(METRIC_KEY, { hero: isNew ? 'v2' : 'current' });
    log(`track("${METRIC_KEY}")`, 'track', `from the ${which} hero`);
    setClicks((n) => n + 1);
  }

  return (
    <>
      {isNew ? <NewHero onCta={handleCta} /> : <CurrentHero onCta={handleCta} />}
      <p className={`hero-ack${clicks ? ' is-sent' : ''}`} role="status" aria-live="polite">
        {clicks === 0
          ? 'Click the button to send a quote-click event to LaunchDarkly.'
          : `Sent ${clicks} ${clicks === 1 ? 'click' : 'clicks'} from the ${which} hero. The event is ${METRIC_KEY}.`}
      </p>
    </>
  );
}

function CurrentHero({ onCta }) {
  return (
    <div className="hero hero-current">
      <h2 className="hero-title">Freight shipping for growing businesses</h2>
      <p className="hero-text">
        Ocean and air freight across Asia Pacific. Tell us what you’re shipping and our team will put together a quote.
      </p>
      <button className="button-secondary" type="button" onClick={onCta}>Request a quote</button>
    </div>
  );
}

function NewHero({ onCta }) {
  return (
    <div className="hero hero-new">
      <div className="hero-copy">
        <h2 className="hero-title">Book a container in minutes, not days.</h2>
        <p className="hero-text">Instant prices on 16 lanes out of Asia, held for 48 hours. No sales call needed.</p>
        <button className="button-primary" type="button" onClick={onCta}>Get an instant quote</button>
      </div>
      <figure className="lane">
        <svg viewBox="0 0 320 140" role="img" aria-label="Route from Singapore to Sydney">
          <path className="lane-path" d="M40 30 C 140 20, 210 70, 280 112" />
          <circle className="lane-port" cx="40" cy="30" r="6" />
          <circle className="lane-port" cx="280" cy="112" r="6" />
          <rect className="lane-ship" x="150" y="40" width="22" height="10" rx="1" />
          <text x="40" y="58" className="lane-label">Singapore</text>
          <text x="280" y="134" className="lane-label" textAnchor="end">Sydney</text>
        </svg>
        <figcaption>Singapore to Sydney, 13 days port to port, 40 ft from USD 3,970</figcaption>
      </figure>
    </div>
  );
}
