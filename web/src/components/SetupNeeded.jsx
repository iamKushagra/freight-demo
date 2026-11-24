export default function SetupNeeded({ error }) {
  return (
    <main className="setup">
      <h1>Connect the demo to LaunchDarkly</h1>
      {error ? (
        <p className="setup-error">The LaunchDarkly SDK could not start: {error}</p>
      ) : (
        <p>The web app needs your LaunchDarkly client-side ID before it can load flags.</p>
      )}
      <ol>
        <li>Copy <code>.env.example</code> to <code>.env</code> in the repository root.</li>
        <li>
          Set <code>VITE_LD_CLIENT_SIDE_ID</code> to the client-side ID from LaunchDarkly → Project settings →
          Environments, and <code>LD_SDK_KEY</code> to the SDK key from the same environment.
          Or run <code>npm run bootstrap</code> with an API token to fill both.
        </li>
        <li>Stop and restart <code>npm run dev</code>. Vite reads <code>.env</code> only at startup.</li>
      </ol>
    </main>
  );
}
