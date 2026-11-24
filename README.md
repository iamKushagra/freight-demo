# ABC Freight × LaunchDarkly

A working demo of how LaunchDarkly lets a team ship faster without shipping more risk. ABC Freight is a fictional ocean-freight company. Its web app has four scenes, one for each part of the exercise, plus a presenter console that shows who you are, what LaunchDarkly is serving you and why, and every flag change as it streams in.

| Scene | Persona | What it shows |
|---|---|---|
| 1. Release and remediate | Engineering manager | A new instant quote ships dark, is released and rolled back from LaunchDarkly with no reload, and is switched off automatically by a flag trigger when a bad release spikes the error rate. |
| 2. Targeted rollout | Developer | A redesigned landing page hero reaches QA by name, then enterprise customers and beta testers by rule, while everyone else falls through to today’s page. |
| 3. Experiment *(extra credit A)* | Product manager | The same flag runs an experiment against a click metric, with a traffic generator so the results UI has data. |
| 4. AI assistant *(extra credit B)* | AI product manager | A shipping chatbot whose model and prompt come from an AI Config, swappable and targetable per customer without a deploy. |

![Release scene after the flag trigger remediated an incident](docs/screenshots/3-incident-resolved.png)

---

## Contents

- [Requirement map](#requirement-map)
- [Architecture](#architecture)
- [What you need](#what-you-need)
- [Quick start (about 10 minutes)](#quick-start-about-10-minutes)
  - [Option A: automated setup](#option-a-automated-setup)
  - [Option B: manual setup](#option-b-manual-setup)
- [Running the demo](#running-the-demo)
- [Project structure](#project-structure)

---

## Requirement map

Every requirement in the exercise, where to see it, and the code that does it.

| Requirement | Where to see it | Code |
|---|---|---|
| **Part 1:** feature behind a flag | Scene 1, the quote widget | `web/src/scenes/ReleaseScene.jsx` (`InstantQuote` vs `QuoteRequestForm`) |
| Toggle ON releases, OFF rolls back, no redeploy | Turn `instant-quote` on and off in LaunchDarkly | same file; the server also gates the API (`server/src/index.js`, `POST /api/quote`) |
| SDK listener, instant switch, no reload | The banner above the widget and the console’s live events | `ldClient.on('change:instant-quote', …)` in `ReleaseScene.jsx`; global `ldClient.on('change', …)` in `web/src/App.jsx` |
| Remediate with a flag trigger | “Ship the bad release” in the incident drill, or `curl` | `server/src/incident.js` (watchdog POSTs to the trigger URL) |
| **Part 2:** flag around a component | Scene 2, the landing page hero | `web/src/components/LandingHero.jsx`, `TargetingScene.jsx` |
| Context with attributes | Console, “Viewing as” | `web/src/personas.js` (`tier`, `country`, `device_type`, `beta_tester`, `employee`, `account_age_days`) |
| Individual targeting | Priya and Marcus (QA) | Flag targets `qa-priya`, `qa-marcus` |
| Rule-based targeting | Aiko (enterprise), Chloe (beta) | Rules `tier is enterprise`, `beta_tester is true` |
| Default rule for everyone else | Sam and Dewi | Default rule serves `false` |
| **Extra A:** metric and experiment | Scene 3 | `ldClient.track('hero-cta-click')` in `LandingHero.jsx`; traffic in `server/src/traffic.js` |
| **Extra B:** AI Config, swap prompt or model without deploy | Scene 4 | `server/src/assistant.js` (AI SDK), `server/src/llm.js` |
| AI quality metrics | Reply footer; AI Config Monitoring tab | `trackDuration`, `trackTokens`, `trackSuccess`, `trackFeedback` in `assistant.js` |

---

## Architecture

```mermaid
flowchart LR
  subgraph Browser["Browser (React, client-side SDK)"]
    UI["Scenes + presenter console"]
  end
  subgraph Server["Node API (server-side SDK + AI SDK)"]
    API["/api routes"]
    WD["Incident watchdog"]
  end
  LD[("LaunchDarkly")]
  LLM["OpenAI / Anthropic<br/>(or built-in mock)"]

  LD -- "streaming flag updates" --> UI
  LD -- "streaming flag updates" --> API
  UI -- "/api via Vite proxy" --> API
  UI -- "track(): conversion events" --> LD
  WD -- "POST flag trigger URL" --> LD
  API -- "AI Config: model + prompt" --> LLM
```

Two SDKs, on purpose. The browser uses the **client-side ID** and the React SDK, so the UI reacts the instant a flag changes. The server uses the **SDK key** and the Node server SDK, so the API enforces the same flag (a stale tab can’t call a disabled feature) and so the AI Config, experiment traffic and audience table run where secrets live.

The API opens its port before the server SDK finishes connecting, and the Vite dev server retries `/api` until that port is up. The first page load does not fail just because LaunchDarkly is still connecting. Flag keys, the experiment metric, and the AI Config key live in `shared/flags.js`. The quote form and the pricing API share the port and container list in `shared/lanes.js`.

---

## What you need

- **Node.js 20 or newer** and npm (bundled with Node). Check with `node -v`.
- **A LaunchDarkly account.** A free trial works: <https://launchdarkly.com/start-trial>.
- macOS, Linux or Windows (WSL or PowerShell). Ports **5173** (web) and **3001** (API) free.
- Internet access from your machine to LaunchDarkly. Corporate proxies that block streaming connections (`*.launchdarkly.com`) will stop live updates.
- Optional: an OpenAI or Anthropic API key to use real models in scene 4. Without one, a built-in mock LLM answers, so the demo runs end to end at no cost.

---

## Quick start (about 10 minutes)

```bash
git clone <this-repo-url> abc-freight-launchdarkly
cd abc-freight-launchdarkly
npm install          # installs the server and web workspaces
cp .env.example .env
```

Then configure LaunchDarkly with **one** of the two options below, and start the app:

```bash
npm run dev          # checks your .env, then starts API (:3001) and web (:5173)
```

Open <http://localhost:5173>. A bar across the top reads the boolean flag `onboarding-test-banner`. While that flag is missing or off, the bar stays neutral. Turn it on in the same project and environment and the bar turns green without a reload.

### Option A: automated setup

Fastest. A script creates everything through the LaunchDarkly REST API and writes the keys into `.env`.

1. In LaunchDarkly, go to **Account settings → Authorization** and create an **access token** with the **Writer** role.
2. In `.env`, set:
   - `LD_API_TOKEN` to that token
   - `LD_PROJECT_KEY` and `LD_ENVIRONMENT_KEY` to the project and environment you want to use. A new trial is usually `default` and `production`.
3. Run:

   ```bash
   npm run bootstrap
   ```

The script fills `LD_SDK_KEY`, `VITE_LD_CLIENT_SIDE_ID` and `LD_TRIGGER_URL`, and creates both flags with targeting, the trigger, and the experiment metric. It is safe to run again: anything that already exists is left alone. The experiment and the AI Config stay manual because they are better shown in the UI; see [Extra credit setup](#extra-credit-setup).

### Option B: manual setup

Everything the script does, by hand. Use the same **project and environment** throughout.

**1. Keys.** Go to **Project settings → Environments → your environment** and copy:

| Copy | Paste into `.env` as |
|---|---|
| SDK key (starts with `sdk-`) | `LD_SDK_KEY` |
| Client-side ID (24 characters) | `VITE_LD_CLIENT_SIDE_ID` |

**2. Flag `instant-quote` (Part 1).** Create a flag:

| Field | Value |
|---|---|
| Name / key | Instant quote / `instant-quote` |
| Type | Boolean. Variation `true`: “Instant quote (new)”. Variation `false`: “Quote request form (legacy)”. |
| Client-side SDK availability | **Tick “SDKs using Client-side ID”** |
| Default rule | serve `true` |
| Off variation | `false` |
| State | **Leave it OFF.** Turning it on is the first demo moment. |

**3. Flag trigger on `instant-quote`.** Open the flag and find **Triggers** (in the flag’s settings). Add a trigger: **Generic trigger**, action **Turn flag off**. Copy the URL into `LD_TRIGGER_URL`. LaunchDarkly shows it only once; if you lose it, reset the URL from the same place.

**4. Flag `landing-hero-v2` (Part 2).** Create a flag:

| Field | Value |
|---|---|
| Name / key | Landing page hero v2 / `landing-hero-v2` |
| Type | Boolean. Variation `true`: “New hero (v2)”. Variation `false`: “Current hero”. |
| Client-side SDK availability | **Tick “SDKs using Client-side ID”** |
| Individual targets | Serve `true` to context kind **user**, keys `qa-priya` and `qa-marcus` |
| Rule 1 | If **user** `tier` **is one of** `enterprise`, serve `true` |
| Rule 2 | If **user** `beta_tester` **is one of** `true` (boolean), serve `true` |
| Default rule | serve `false` |
| State | **ON** |

Rule order matters only for the label the console shows (“Rule 1”, “Rule 2”).

**5. Restart `npm run dev`** after any change to `.env`. Vite reads it only at startup.

To confirm the setup, open scene 2. The “Who gets the new hero” table lists what each persona should see; a **check setup** marker means a target or rule differs from the steps above.

---

## Running the demo

Use the persona picker in the console (right) to switch contexts. Every switch calls `ldClient.identify()` and the page re-evaluates for that person. For a full live talk track, see [`docs/demo-script.md`](docs/demo-script.md).

**Scene 1: Release and remediate.** With LaunchDarkly open beside the app:

1. Turn `instant-quote` **ON**. The legacy request form becomes the instant quote, the banner shows the change listener firing, and the console logs the streamed change. Get a quote: USD 4,490 for Chennai to Rotterdam, 40 ft.
2. Turn it **OFF**. Instant rollback, no reload.
3. Turn it **ON** again, then click **Ship the bad release**. Synthetic traffic starts failing; at a 25% error rate the watchdog fires the flag trigger; the flag turns off, the server and browser both receive it, and the banner reports how many milliseconds remediation took after the trigger fired.
4. To fire the trigger yourself instead (or if `LD_TRIGGER_URL` is unset), run:

   ```bash
   curl -X POST "<your LD_TRIGGER_URL>"
   ```

   To rerun the drill: **Reset drill**, then turn the flag back on.

**Scene 2: Targeted rollout.** Switch between personas and watch the hero and the explanation change:

| Persona | Key | Sees | Why |
|---|---|---|---|
| Priya Raman, QA | `qa-priya` | New | Individual target |
| Marcus Lee, QA | `qa-marcus` | New | Individual target |
| Aiko Tanaka, enterprise | `cust-aiko-tanaka` | New | Rule 1: `tier` is enterprise |
| Chloe Nguyen, beta | `cust-chloe-nguyen` | New | Rule 2: `beta_tester` is true |
| Sam Patel, pro | `cust-sam-patel` | Current | Default rule |
| Dewi Santoso, free | `visitor-dewi-s` | Current | Default rule |

Edit a rule in LaunchDarkly, for example add `pro` to rule 1. The audience table updates within a few seconds.