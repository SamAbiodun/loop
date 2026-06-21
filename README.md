# loop

A browser app for practising **data-structures & algorithms interviews out loud**. Pick a problem, then talk through it with an AI interviewer over voice — it listens, probes your reasoning, gives hints when asked, and can write into your code editor. Powered by the OpenAI Realtime API.

> Personal project. Not multi-tenant; no auth/billing.

## Features

- **Voice-first mock interview** — speech-to-speech via OpenAI Realtime (WebRTC), with a 5-phase interviewer (clarify → approach → code → test → analyze).
- **NeetCode 150** problem bank, original statements with worked examples, grouped by category and **searchable**, plus an opt-in pool from the open APPS dataset.
- **Monaco code editor** — your code is streamed into the interviewer's context live, and the interviewer can edit the editor via a tool.
- **Cost controls** — a model toggle (**Practice** = `gpt-realtime-mini`, the cheaper default; **Hard** = `gpt-realtime-2`), a concise interviewer prompt, and a 30-minute session cap.

## Prerequisites

- **Node.js ≥ 20.9.0** (Next 16 requires it). macOS: `brew install node`, or use `nvm`, or https://nodejs.org.
- **npm** — ships with Node.js, so installing Node gives you npm. Verify both:
  ```bash
  node --version   # >= v20.9.0
  npm --version
  ```
- **An OpenAI API key** with Realtime API access and available credit.
- A Chromium-based browser with a microphone (used over `localhost`, a secure context).

## Quick start

```bash
git clone <this-repo-url> loop
cd loop
npm run setup          # see below — handles the non-npm dependency for you
# add your key to .env.local:  OPENAI_API_KEY=sk-...
npm run dev
```

Then open **http://localhost:3000** (use `localhost`, not the LAN IP — the mic needs a secure context), pick a problem, and **Start session**.

### What `npm run setup` does

The voice layer, [`realtime-voice-component`](https://github.com/openai/realtime-voice-component), is **not published to npm** — it's referenced as a sibling checkout (`file:../realtime-voice-component`). So a plain `npm install` fails with *"can't resolve realtime-voice-component"*. `scripts/setup.sh` handles it:

1. Checks `git` / Node ≥ 20.9 / npm.
2. Clones `realtime-voice-component` **next to** this repo (skips if present).
3. `npm install` + `npm run build` inside it (a fresh clone has no `dist/`).
4. `npm install --install-links` here — copies the component into `node_modules` (Turbopack can't follow the `file:` symlink).
5. Seeds `.env.local` from the example if missing.

It's idempotent. The required layout is two siblings:

```
parent/
├── loop/                      ← this repo
└── realtime-voice-component/  ← cloned by setup
```

If you ever rebuild the component, re-run `npm install --install-links` (or `npm run setup`).

## Project layout

```
src/
  app/
    api/session/route.ts     POST /api/session — proxies the SDP exchange to OpenAI
    layout.tsx page.tsx globals.css
  features/
    voice/                   generic realtime config
      config.ts                session endpoint, model toggle, audio/turn detection
      index.ts                 import from "@/features/voice"
    interview/               the interview domain
      problems.ts              NeetCode 150 (original statements) + grouping
      examples.ts              worked examples per problem
      prompts.ts               interviewer system prompt
      tools.ts                 request_hint / edit_code / end_session tools
      interviewController.ts   builds the voice controller for a session
      ProblemPicker.tsx        search + grouped list + mode toggle
      CodeEditor.tsx           Monaco wrapper
      InterviewSurface.tsx     editor + transcript + controls
      InterviewApp.tsx         pick → interview state machine
  lib/
    env.ts                   validated, server-only env access
scripts/
  setup.sh                   one-shot setup for new clones
  build-problems.mjs         regenerate the opt-in open dataset (problems.open.json)
  repro-session.mjs          headless smoke test of the voice session
```

## Notes

- This is a **modified Next.js** build — see [`AGENTS.md`](./AGENTS.md) (read the bundled docs in `node_modules/next/dist/docs/` before changing Next-specific code).
- `reactStrictMode` is **off** (`next.config.ts`): the voice controller is permanently destroyed on unmount, and Strict Mode's dev double-mount would leave it dead, making `connect()` a silent no-op.
- Realtime audio is billed per minute. Practice mode + the session cap keep it cheap, but the meter is live.
