# loop

A browser app for practising **data-structures & algorithms interviews out loud**. It runs a free-form spoken interview using the OpenAI Realtime API — you talk through a problem, the model interviews you back.

> Personal project. Not multi-tenant; no auth/billing.

## Stack

- **Next.js** (App Router, TypeScript, Tailwind) — note: a modified build, see [`AGENTS.md`](./AGENTS.md).
- **[`realtime-voice-component`](https://github.com/openai/realtime-voice-component)** — the WebRTC/realtime controller layer.
- **OpenAI Realtime API** — reached through a thin server proxy so the API key never hits the browser.

## Project layout

```
src/
  app/                     routing only — kept thin
    api/session/route.ts   POST /api/session — proxies the SDP exchange to OpenAI
    layout.tsx page.tsx globals.css
  features/
    voice/                 self-contained realtime voice feature
      controller.ts          builds the voice controller
      VoicePanel.tsx         start/stop UI
      config.ts              session endpoint + prompt (single source of truth)
      index.ts               public surface — import from "@/features/voice"
  lib/
    env.ts                 validated, server-only env access
```

New domains (interview problems, the Monaco editor, scoring) get their own folder under `features/`.

## Getting started

1. Add your OpenAI key:
   ```bash
   cp .env.local.example .env.local
   # then edit .env.local and set OPENAI_API_KEY=sk-...
   ```
   The account needs Realtime API access and available credit.

2. Run the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, click **Start session**, allow the mic, and say "hello".

## The local voice component

`realtime-voice-component` is consumed from a sibling checkout and **copy-installed**, because Turbopack can't follow `npm`'s `file:` symlinks:

```bash
npm install --install-links ../realtime-voice-component
```

Re-run that command any time you rebuild the component.
