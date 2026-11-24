import { useEffect, useRef, useState } from 'react';
import { AI_CONFIG_KEY } from '../flags.js';
import { firstName } from '../personas.js';
import { api } from '../lib/api.js';
import { useLog } from '../lib/log.jsx';

const STARTERS = [
  'How much to ship a 40 ft container from Chennai to Rotterdam?',
  'My shipment is late. What can you do?',
  'Which customs documents do I need for Australia?',
];

export default function AssistantScene({ persona }) {
  const { log } = useLog();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { setMessages([]); setError(null); }, [persona.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);

  async function send(text) {
    const content = text.trim();
    if (!content || busy) return;
    const history = [...messages, { role: 'user', content }];
    setMessages(history);
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      const res = await api('/api/chat', {
        context: persona.context,
        messages: history.map(({ role, content: c }) => ({ role, content: c })),
      });
      setMessages([...history, { role: 'assistant', content: res.reply, meta: res.meta, responseId: res.responseId }]);
      if (res.meta?.enabled) {
        log(`AI Config served ${res.meta.model}`, 'stream', `${res.meta.latencyMs} ms, ${res.meta.tokens.total} tokens`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function rate(index, positive) {
    const msg = messages[index];
    setMessages(messages.map((m, i) => (i === index ? { ...m, feedback: positive ? 'up' : 'down' } : m)));
    await api('/api/chat/feedback', { responseId: msg.responseId, positive }).catch(() => {});
    log(`Feedback: ${positive ? 'helpful' : 'not helpful'}`, 'track', 'recorded against the AI Config variation');
  }

  return (
    <>
      <header className="scene-header">
        <h1 id="scene-heading">Change the assistant’s model and prompt without a deploy</h1>
        <p className="lede">
          The shipping assistant reads its model and system prompt from the AI Config <code>{AI_CONFIG_KEY}</code> on
          every message. Change the variation in LaunchDarkly, ask again, and the next answer comes from the new setup.
        </p>
      </header>

      <div className="chat-layout">
        <section className="chat" aria-label={`Chat with the ABC Freight assistant as ${firstName(persona)}`}>
          <ol className="chat-log">
            {messages.length === 0 && (
              <li className="chat-empty">
                <p>Ask as {firstName(persona)}. Try one of these:</p>
                <div className="starters">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" className="starter" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </li>
            )}
            {messages.map((m, i) => (
              <li key={i} className={`bubble bubble-${m.role}`}>
                <p>{m.content}</p>
                {m.meta && <ReplyMeta meta={m.meta} />}
                {m.meta?.enabled && (
                  <div className="feedback">
                    <button type="button" aria-pressed={m.feedback === 'up'} disabled={Boolean(m.feedback)} onClick={() => rate(i, true)}>Helpful</button>
                    <button type="button" aria-pressed={m.feedback === 'down'} disabled={Boolean(m.feedback)} onClick={() => rate(i, false)}>Not helpful</button>
                  </div>
                )}
              </li>
            ))}
            {busy && <li className="bubble bubble-assistant is-typing"><p>Thinking…</p></li>}
            <li ref={endRef} aria-hidden="true" />
          </ol>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
            <label className="visually-hidden" htmlFor="chat-draft">Message</label>
            <input id="chat-draft" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about a shipment" autoComplete="off" />
            <button className="button-primary" type="submit" disabled={busy || !draft.trim()}>Send</button>
          </form>
        </section>

        <aside className="why">
          <h2 className="panel-title">What to try</h2>
          <ul className="try-list">
            <li>Change the default rule to a different variation, then ask again. Model, latency and tone change on the next reply.</li>
            <li>Switch to Aiko, an enterprise customer. A rule on <code>tier</code> can serve her a premium model and prompt.</li>
            <li>Disable the AI Config. The assistant steps aside gracefully instead of failing.</li>
            <li>Open the AI Config’s Monitoring tab to compare latency, tokens and feedback per variation.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}

function ReplyMeta({ meta }) {
  if (!meta.enabled) return <p className="reply-meta">AI Config disabled for this context.</p>;
  return (
    <dl className="reply-meta">
      <div><dt>Variation</dt><dd>{meta.variation ?? meta.source}</dd></div>
      <div><dt>Model</dt><dd>{meta.model}</dd></div>
      <div><dt>Ran on</dt><dd>{meta.provider}</dd></div>
      <div><dt>Latency</dt><dd>{meta.latencyMs} ms</dd></div>
      <div><dt>Tokens</dt><dd>{meta.tokens.total}</dd></div>
    </dl>
  );
}
