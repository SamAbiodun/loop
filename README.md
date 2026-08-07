# loop

A browser app for practising **data-structures & algorithms interviews out loud**. Pick a problem, then talk through it with an AI interviewer over voice — it listens, probes your reasoning, gives hints when asked, and can write into your code editor. Powered by the OpenAI Realtime API.

> Personal project. Access is intentionally lightweight; it is not a general-purpose identity or billing system.

## Features

- **Voice-first mock interview** — speech-to-speech via OpenAI Realtime (WebRTC), with a 5-phase interviewer (clarify → approach → code → test → analyze).
- **NeetCode 150** problem bank, original statements with worked examples, grouped by category and **searchable**, plus an opt-in pool from the open APPS dataset.
- **Monaco code editor** — per-language starters and buffers, a **Run ▶** panel that executes your code, and interviewer tools to read the live editor state and write into it.
- **Cost controls** — a server-side model allowlist, concise interviewer prompt, request quotas, usage lifecycle accounting, and a 30-minute session cap. Leaving or hiding a live interview ends it instead of keeping an unseen paid session open.

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
    api/usage/route.ts       POST /api/usage — connect/finalize authenticated voice usage
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
    codes.ts                 hashed access-code records, generation, atomic usage counters
    kv.ts                    Upstash Redis store + expiring/atomic primitives
    security.ts              bounded JSON parsing, request identity, rate limiting, timeouts
    usage.ts                 idempotent voice-session lifecycle accounting
scripts/
  setup.sh                   one-shot setup for new clones
  build-problems.mjs         regenerate the opt-in open dataset (problems.open.json)
  repro-session.mjs          headless smoke test of the voice session
.github/workflows/ci.yml    lint, typecheck, unit tests, and production build
```

## Architecture & design decisions

The stack, and *why* each piece was chosen (the **how** — setup, env vars,
commands — lives under [Deploying](#deploying)):

| Layer | Choice | Why |
| ----- | ------ | --- |
| **Framework** | Next.js (App Router) + TypeScript | One project for the UI **and** the server-side API routes it needs, deployed as a unit. The routes exist so the OpenAI key and code-runner never touch the browser. |
| **Hosting** | **Vercel** (project `loop-interview`) | First-class Next.js host with a Node runtime for the API routes — static hosting (e.g. GitHub Pages) can't run them. Git pushes create deployments: `main` is production; `dev` and PR branches are previews. |
| **Voice** | OpenAI Realtime via [`@openai/agents`](https://github.com/openai/openai-agents-js) (`RealtimeAgent`/`RealtimeSession`) over WebRTC | Speech-to-speech with browser-native audio. `/api/session` mints a short-lived **ephemeral** client secret so the real API key never reaches the browser. |
| **Editor** | Monaco (`@monaco-editor/react`) | VS Code-grade editing; per-language buffers and starters. |
| **Code runner** | Paiza.io, proxied via `/api/run` | Runs arbitrary candidate code without us hosting a sandbox; Paiza's guest API is free and needs no signup. (Piston, the original pick, went whitelist-only in Feb 2026.) Trade-off: code is sent to a third-party public service. |
| **Access control** | Multi-code gate + `/admin` dashboard | A public URL can't be allowed to drain OpenAI credit. Instead of one shared password, there are **labelled access codes** with per-code usage (sessions / runs / voice-minutes) and one-click disable. Enforced server-side and re-checked every request, so revocation is instant. See [Access codes](#access-codes-gate--usage--disable). |
| **Database** | **Upstash Redis** (Vercel Marketplace integration) | The access codes + usage counters need persistent, mutable, low-latency state — a natural fit for serverless Redis (KV + atomic counters + flags), on a free tier, auto-wired into Vercel. Postgres would be overkill for a handful of codes. Falls back to a non-persistent in-memory store when no Redis is configured (local dev only). |
| **Admin dashboard** | `/admin`, gated by `ADMIN_PASSCODE` | Web UI to generate labelled codes, watch per-code usage, and enable/disable/delete — manageable from any device, no redeploys. Codes-mode is tied to `ADMIN_PASSCODE` on purpose: codes can only be minted here, so without it the gate would lock everyone out. |
| **Domain / DNS** | `loop.samabiodun.tech`, DNS on **Cloudflare** | A subdomain, so the root `samabiodun.tech` portfolio is untouched. Grey-cloud (DNS-only) CNAME → Vercel; see [Custom domain / DNS](#custom-domain--dns). |

`reactStrictMode` is enabled. Realtime and microphone resources are created only from the explicit Start gesture and are cleaned up idempotently.

## Deploying

**Live at [https://loop.samabiodun.tech](https://loop.samabiodun.tech).**

- **Host:** Vercel, project **`loop-interview`** (org `samuel-abioduns-projects-962679c9`).
  Chosen because the app needs a Node host — `/api/session` (mints the ephemeral
  OpenAI key), `/api/run`, and the admin/usage routes run server-side — so
  static hosting (GitHub Pages) can't serve it. Vercel's free tier covers it.
- **Database:** Upstash Redis (Vercel Marketplace integration), holding access
  codes + usage counters. See [Access codes](#access-codes-gate--usage--disable).
- **Domain/DNS:** `loop.samabiodun.tech` — a subdomain. The root
  `samabiodun.tech` is the separate portfolio site and is untouched. DNS is
  managed in **Cloudflare** (see [Custom domain / DNS](#custom-domain--dns)).

### Deploying updates

The Vercel project is connected to this GitHub repo with **production branch =
`main`**, so deploys are driven by git:

- **`main` → production.** Merging/pushing to `main` builds and deploys to
  production, and aliases `loop.samabiodun.tech`.
- **`dev` and PR branches → preview.** Each push gets its own preview URL
  (protected by Vercel deployment auth — only you can open it).

Release flow: branch off `dev` → PR into `dev` → validate its preview → when
explicitly ready for production, promote `dev` to `main`. Do not run a
production deployment while validating `dev`.

```bash
git push origin dev               # preview deployment only
# Production is a separate, deliberate main-branch operation.
```

`ADMIN_PASSCODE` / `OPENAI_API_KEY` / `UPSTASH_*` are stored on the Vercel
project and persist across deploys; changing an env var needs a redeploy to take
effect. For preview deploys (`dev`/PRs) to be fully functional, scope those env
vars to **Preview** as well as Production. Running `vercel --prod` is explicitly
a production action and is not part of the preview workflow.

**Environment variables** (Vercel → Project → Settings → Environment Variables — all set in production):

| Variable         | Required | Purpose                                                                 |
| ---------------- | -------- | ----------------------------------------------------------------------- |
| `OPENAI_API_KEY` | yes      | Realtime API access + credit. Never shipped to the browser.             |
| `ADMIN_PASSCODE` | deployed | Turns on the **multi-code** access system and guards `/admin`. Set this on every public deployment so it cannot drain OpenAI credit. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | deployed codes mode | Where access codes + usage live. Auto-injected by the Upstash Vercel integration. A Vercel deployment now refuses codes mode without persistent Redis; the in-memory fallback is local-development only. |
| `APP_PASSCODE`   | no       | Legacy single-passcode fallback, used only when `ADMIN_PASSCODE` is unset. No usage tracking. |

### Access codes (gate + usage + disable)

When `ADMIN_PASSCODE` is set the app runs in **codes mode**: visitors must
enter a valid access code, and `/api/session` / `/api/run` reject any request
without one. Enforcement is server-side (an httpOnly cookie holding the code),
and the code is **re-checked on every request** — so disabling a code locks its
holder out immediately, even mid-visit.

Manage codes at **`/admin`** (sign in with `ADMIN_PASSCODE`):

- **Generate** a new code with a label (e.g. "Recruiter — Acme"). Its plaintext
  is shown once so it can be shared; only a SHA-256 digest and masked display
  value are retained afterward. Existing legacy plaintext records are migrated
  lazily when used.
- See per-code **usage**: sessions started, code runs, estimated voice minutes
  (the OpenAI cost driver), and last-used time.
- **Enable/disable** any code with one click, or delete it.

Code digests and counters persist in **Upstash Redis** — add it from the Vercel
Marketplace (free tier) and it injects the two `UPSTASH_REDIS_REST_*` vars
automatically. Locally, leave everything unset to run fully open; set
`ADMIN_PASSCODE` alone to exercise the panel against the in-memory store.

Sensitive routes also enforce bounded request bodies, input validation, provider
timeouts, and per-actor rate limits. Session usage is counted only after a
Realtime connection succeeds, and final duration reporting is idempotent and
server-capped. These are abuse controls, not a substitute for monitoring the
OpenAI and Vercel dashboards.

### Custom domain / DNS

The domain is attached in Vercel (`vercel domains add loop.samabiodun.tech
loop-interview`, or the Domains tab). DNS for `samabiodun.tech` is managed in
**Cloudflare** — the registrar (orderbox) delegates its nameservers to
Cloudflare (`*.ns.cloudflare.com`), so records live in the Cloudflare
dashboard, **not** the registrar panel.

The record for the subdomain (Cloudflare → `samabiodun.tech` → DNS → Records):

| Type | Name | Target | Proxy |
| ---- | ---- | ------ | ----- |
| CNAME | `loop` | `cname.vercel-dns.com` | **DNS only (grey cloud)** |

**Grey cloud is required** — Cloudflare's orange-cloud proxy terminates TLS
itself and breaks Vercel's cert (`ERR_SSL_UNRECOGNIZED_NAME_ALERT`). Vercel
auto-issues the Let's Encrypt cert once it sees the record; a freshly-issued
cert can take up to ~an hour to propagate across all edge PoPs (the
`…vercel.app` URL works immediately meanwhile). The root `samabiodun.tech`
(portfolio) and its records are untouched.

> **Domain email note:** the domain isn't set up to send/receive mail. If you
> add email later (e.g. Cloudflare Email Routing to forward inbound, or Zoho
> for a real mailbox), do **not** apply a "sends no email" `v=spf1 -all`
> lockdown — the mail provider needs its own SPF/MX records.

## Notes

- `reactStrictMode` is **on** (`next.config.ts`). The RealtimeSession and microphone are created only after **Start session**, and cleanup safely tolerates repeated calls.
- **Run ▶** sends the editor contents to a third-party public runner (Paiza.io) — don't paste anything sensitive.
- Realtime audio is billed per minute. Practice mode, rate limits, background cleanup, and the session cap reduce exposure, but the provider meter is authoritative.
- Run `npm run check` before pushing; CI repeats lint, TypeScript, Vitest, and the webpack production build.
