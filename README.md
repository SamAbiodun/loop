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
    api/unlock/route.ts      POST /api/unlock — validate an access code, set the gate cookie
    api/usage/route.ts       POST /api/usage — record voice seconds against a code (beacon)
    api/admin/unlock         admin sign-in
    api/admin/codes          list / generate / enable-disable / delete access codes
    admin/page.tsx           the /admin access-code dashboard
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
    admin/AdminPanel.tsx     the access-code dashboard UI
  lib/
    env.ts                   validated, server-only env access
    auth.ts                  gate mode (codes / passcode / open) + admin auth
    codes.ts                 access-code records, generation, usage counters
    kv.ts                    Upstash Redis store (in-memory fallback for dev)
scripts/
  setup.sh                   one-shot setup for new clones
  build-problems.mjs         regenerate the opt-in open dataset (problems.open.json)
  repro-session.mjs          headless smoke test of the voice session
```

## Deploying

Deployed at **https://loop.samabiodun.tech** (Vercel). It needs a Node host — the
`/api/session` and `/api/run` routes run server-side — so static hosting (GitHub
Pages) won't work.

**Environment variables** (Vercel → Project → Settings → Environment Variables):

| Variable         | Required | Purpose                                                                 |
| ---------------- | -------- | ----------------------------------------------------------------------- |
| `OPENAI_API_KEY` | yes      | Realtime API access + credit. Never shipped to the browser.             |
| `ADMIN_PASSCODE` | prod     | Turns on the **multi-code** access system and guards `/admin`. Set this in production so a public URL can't drain your OpenAI credit. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | prod | Where access codes + usage live. Auto-injected by the Upstash Vercel integration. Without them the code store falls back to non-persistent in-memory (resets on redeploy). |
| `APP_PASSCODE`   | no       | Legacy single-passcode fallback, used only when `ADMIN_PASSCODE` is unset. No usage tracking. |

### Access codes (gate + usage + disable)

When `ADMIN_PASSCODE` is set the app runs in **codes mode**: visitors must
enter a valid access code, and `/api/session` / `/api/run` reject any request
without one. Enforcement is server-side (an httpOnly cookie holding the code),
and the code is **re-checked on every request** — so disabling a code locks its
holder out immediately, even mid-visit.

Manage codes at **`/admin`** (sign in with `ADMIN_PASSCODE`):

- **Generate** a new code with a label (e.g. "Recruiter — Acme"). Share the
  generated code with whoever you want to let in.
- See per-code **usage**: sessions started, code runs, estimated voice minutes
  (the OpenAI cost driver), and last-used time.
- **Enable/disable** any code with one click, or delete it.

Codes and counters persist in **Upstash Redis** — add it from the Vercel
Marketplace (free tier) and it injects the two `UPSTASH_REDIS_REST_*` vars
automatically. Locally, leave everything unset to run fully open; set
`ADMIN_PASSCODE` alone to exercise the panel against the in-memory store.

**Custom domain / DNS.** Add `loop.samabiodun.tech` in Vercel's Domains tab, then
create the record it shows at your registrar (a `CNAME` from `loop` →
`cname.vercel-dns.com`). The root `samabiodun.tech` is untouched — it stays on
GitHub Pages.

## Notes

- `reactStrictMode` is **off** (`next.config.ts`): the RealtimeSession (WebRTC + mic) is created once per interview mount, and Strict Mode's dev double-mount would tear it down mid-handshake.
- **Run ▶** sends the editor contents to a third-party public runner (Paiza.io) — don't paste anything sensitive.
- Realtime audio is billed per minute. Practice mode + the session cap keep it cheap, but the meter is live.
