import React from 'react';
import { createRoot } from 'react-dom/client';
import { asyncWithLDProvider } from 'launchdarkly-react-client-sdk';
import App from './App.jsx';
import SetupNeeded from './components/SetupNeeded.jsx';
import { DEFAULT_PERSONA } from './personas.js';
import './styles.css';

const root = createRoot(document.getElementById('root'));

async function start() {
  const clientSideID = import.meta.env.VITE_LD_CLIENT_SIDE_ID;
  if (!clientSideID) {
    root.render(<SetupNeeded />);
    return;
  }

  try {
    const LDProvider = await asyncWithLDProvider({
      clientSideID,
      context: DEFAULT_PERSONA.context,
      timeout: 5,
      options: {
        streaming: true,
        evaluationReasons: true,
      },
      reactOptions: {
        useCamelCaseFlagKeys: false,
      },
    });
    root.render(
      <React.StrictMode>
        <LDProvider>
          <App />
        </LDProvider>
      </React.StrictMode>,
    );
  } catch (err) {
    root.render(<SetupNeeded error={err.message} />);
  }
}

start();
