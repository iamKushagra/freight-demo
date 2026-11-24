import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlags, useLDClient } from 'launchdarkly-react-client-sdk';
import { LogProvider, useLog } from './lib/log.jsx';
import { DEFAULT_PERSONA, PERSONAS } from './personas.js';
import Console from './components/Console.jsx';
import ReleaseScene from './scenes/ReleaseScene.jsx';
import TargetingScene from './scenes/TargetingScene.jsx';
import ExperimentScene from './scenes/ExperimentScene.jsx';
import AssistantScene from './scenes/AssistantScene.jsx';

const SCENES = [
  { id: 'release', title: 'Release and remediate', who: 'Engineering manager', Component: ReleaseScene },
  { id: 'targeting', title: 'Targeted rollout', who: 'Developer', Component: TargetingScene },
  { id: 'experiment', title: 'Experiment', who: 'Product manager', Component: ExperimentScene },
  { id: 'assistant', title: 'AI assistant', who: 'AI product manager', Component: AssistantScene },
];

const sceneFromHash = () => SCENES.find((s) => `#${s.id}` === window.location.hash)?.id ?? 'release';
const show = (value) => (value === undefined ? 'unset' : value ? 'ON' : 'OFF');
const TEST_FLAG_KEY = 'onboarding-test-banner';
const TEST_FLAG_URL = 'https://app.launchdarkly.com/projects/default/flags/onboarding-test-banner/targeting?env=production';

export default function App() {
  return (
    <LogProvider>
      <Shell />
    </LogProvider>
  );
}

function Shell() {
  const ldClient = useLDClient();
  const { log } = useLog();
  const [persona, setPersona] = useState(DEFAULT_PERSONA);
  const [sceneId, setSceneId] = useState(sceneFromHash);
  const switchingContext = useRef(false);

  useEffect(() => {
    const onHash = () => setSceneId(sceneFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!ldClient) return undefined;
    const onChange = (changes) => {
      for (const [key, { current, previous }] of Object.entries(changes)) {
        if (switchingContext.current) {
          log(`${key}: ${show(previous)} to ${show(current)}`, 'context', 'Re-evaluated for the new context');
        } else {
          log(`${key}: ${show(previous)} to ${show(current)}`, 'stream', 'Streamed from LaunchDarkly, no reload');
        }
      }
    };
    ldClient.on('change', onChange);
    return () => ldClient.off('change', onChange);
  }, [ldClient, log]);

  const switchPersona = useCallback(async (id) => {
    const next = PERSONAS.find((p) => p.id === id);
    if (!next || !ldClient || next.id === persona.id) return;
    switchingContext.current = true;
    setPersona(next);
    try {
      await ldClient.identify(next.context);
      log(`Viewing as ${next.context.name}`, 'context', `context key ${next.context.key}`);
    } finally {
      setTimeout(() => { switchingContext.current = false; }, 250);
    }
  }, [ldClient, log, persona.id]);

  const scene = SCENES.find((s) => s.id === sceneId);
  const { Component } = scene;

  return (
    <div className="shell">
      <TestBanner />
      <header className="masthead">
        <a className="brand" href="#release" aria-label="ABC Freight home">
          <ContainerMark />
          <span className="brand-name">ABC Freight</span>
        </a>
        <p className="masthead-note">Feature management demo built on LaunchDarkly</p>
      </header>

      <main className="stage">
        <nav className="scene-nav" aria-label="Demo scenes">
          <ol>
            {SCENES.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} aria-current={s.id === sceneId ? 'page' : undefined}>
                  <span className="scene-num">{i + 1}</span>
                  <span className="scene-title">{s.title}</span>
                  <span className="scene-who">{s.who}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <section className="scene" aria-labelledby="scene-heading">
          <Component persona={persona} />
        </section>
      </main>

      <Console persona={persona} onSwitchPersona={switchPersona} />
    </div>
  );
}

function TestBanner() {
  const flags = useFlags();
  const on = flags[TEST_FLAG_KEY] === true;
  return (
    <aside className={on ? 'ld-test-banner is-on' : 'ld-test-banner'} role="status">
      <p>{on ? 'LaunchDarkly test banner (flag is on)' : 'LaunchDarkly test banner (flag is off)'}</p>
      <a href={TEST_FLAG_URL} target="_blank" rel="noreferrer">View flag</a>
    </aside>
  );
}

function ContainerMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 24" aria-hidden="true">
      <rect x="1" y="2" width="38" height="20" rx="1" />
      {[8, 14, 20, 26, 32].map((x) => <line key={x} x1={x} y1="5" x2={x} y2="19" />)}
    </svg>
  );
}
