# loop

A browser app for practising **data-structures & algorithms interviews out loud**. Pick a problem, then talk through it with an AI interviewer over voice — it listens, probes your reasoning, gives hints when asked, and can write into your code editor. Powered by the OpenAI Realtime API.

> Personal project. Not multi-tenant; no auth/billing.

## Features

- **Voice-first mock interview** — speech-to-speech via OpenAI Realtime (WebRTC), with a 5-phase interviewer (clarify → approach → code → test → analyze).
- **NeetCode 150** problem bank, original statements with worked examples, grouped by category and **searchable**, plus an opt-in pool from the open APPS dataset.
- **Monaco code editor** — per-language starters and buffers, a **Run ▶** panel that executes your code, and interviewer tools to read the live editor state and write into it.
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
npm run setup          # checks Node ≥ 20.9, installs deps, seeds .env.local
# add your key to .env.local:  OPENAI_API_KEY=sk-...
npm run dev
```

Then open **http://localhost:3000** (use `localhost`, not the LAN IP — the mic needs a secure context), pick a problem, and **Start session**.

The voice layer is [`@openai/agents`](https://github.com/openai/openai-agents-js) (`RealtimeAgent` + `RealtimeSession` over browser WebRTC); everything installs from npm, so `npm install` + copying `.env.local.example` by hand works too — `npm run setup` just bundles it.

## Project layout

```
src/
  app/
    api/session/route.ts     POST /api/session — mints an ephemeral Realtime client secret
    api/run/route.ts         POST /api/run — executes editor code via a public runner
    layout.tsx page.tsx globals.css
  features/
    voice/                   generic realtime config
      config.ts                session endpoint, model toggle, voice/turn-detection tunables
      index.ts                 import from "@/features/voice"
    interview/               the interview domain
      problems.ts              NeetCode 150 (original statements) + grouping
      examples.ts              worked examples per problem
      languages.ts             editor languages + per-language runnable starters
      prompts.ts               interviewer system prompt
      tools.ts                 get_editor_state / request_hint / edit_code / end_session
      interviewController.ts   builds the RealtimeAgent + RealtimeSession for a session
      ProblemPicker.tsx        search + grouped list + mode toggle
      CodeEditor.tsx           Monaco wrapper
      InterviewSurface.tsx     editor + run output + transcript + controls
      InterviewApp.tsx         pick → interview state machine
  lib/
    env.ts                   validated, server-only env access
scripts/
  setup.sh                   one-shot setup for new clones
  build-problems.mjs         regenerate the opt-in open dataset (problems.open.json)
  repro-session.mjs          headless smoke test of the voice session
```

## Notes

- `reactStrictMode` is **off** (`next.config.ts`): the RealtimeSession (WebRTC + mic) is created once per interview mount, and Strict Mode's dev double-mount would tear it down mid-handshake.
- **Run ▶** sends the editor contents to a third-party public runner (Paiza.io) — don't paste anything sensitive.
- Realtime audio is billed per minute. Practice mode + the session cap keep it cheap, but the meter is live.
