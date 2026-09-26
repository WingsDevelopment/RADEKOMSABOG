# RADE KOMŠA — BOG MIDLEJNA

A deliberately absurd, bilingual Egyptian Dota 2 challenger temple. Vanilla HTML/CSS/JavaScript, Vite, Cloudflare Pages Functions, and D1. Serbian Latin is the default; the visible SR / EN switch changes language immediately and remembers the choice in localStorage. No React, audio, public challenger feed, analytics, remote fonts, or runtime frontend dependencies.

## Requirements

- Node.js 22.12+ and npm.
- A Cloudflare account with Pages and D1 access for deployment.
- A real D1 database ID in `wrangler.toml` and an `IP_HASH_SALT` secret.

## Install and develop

```sh
npm install
npm run dev
```

Vite prints the local URL (normally http://127.0.0.1:5173). This starts the frontend with hot reload. API requests proxy to port 8788; run the following setup to enable actual local saves. The frontend never fakes a successful save when the API is unavailable.

Copy `.dev.vars.example` to `.dev.vars` and replace the example secret with a random string. Generate one using:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npm run db:local
npm run build
npm run dev:api
```

Keep `dev:api` running in another terminal alongside `npm run dev`. Wrangler serves the full built site and Functions at http://localhost:8788; Vite proxies `/api` there. Restart Wrangler after changing server code if it does not reload automatically. Rebuild to update static files served directly by Wrangler. Local D1 data lives in `.wrangler/`, separate from production. The all-zero ID is a local placeholder; replace it before remote operations.

## Create and bind D1

```sh
npx wrangler login
npx wrangler d1 create rade-challengers
```

Copy the returned database UUID into `database_id` in `wrangler.toml`. Keep the binding named `DB`, database name `rade-challengers`, and `migrations_dir = "migrations"`. The Pages Function accesses `env.DB`. The Wrangler file is the source of truth for bindings on deployment.

```sh
npm run db:remote
```

This applies `migrations/0001_create_challengers.sql` to the remote database. `npm run db:local` applies the same migration to local storage. Migrations are not applied by the deployment command: run them before deploying changes that need a new schema.

## Deploy to Cloudflare Pages

```sh
npx wrangler pages project create rade-komsa --production-branch main
npx wrangler pages secret put IP_HASH_SALT --project-name rade-komsa
npm run deploy
```

Paste a generated 32-byte random secret when prompted. Do not commit it. `npm run deploy` builds Vite and runs `wrangler pages deploy dist`; Wrangler reads the project name, D1 binding, and Functions directory automatically. If prompted for a branch outside Git, choose `main`, or run `npx wrangler pages deploy dist --project-name rade-komsa --branch main`. The CLI returns the deployed URL. A Pages dashboard drag-and-drop upload is not suitable for this Functions app.

For Git integration, choose Vite, build command `npm run build`, output directory `dist`, root directory `/`, and Node 22.12+ (for example `NODE_VERSION=22`). Configure the `IP_HASH_SALT` secret for the intended environment in Pages settings and redeploy. Use a separate D1 database and secret for preview deployments if enabling them; do not connect public PR previews to production data. This project includes no account credentials and is not automatically deployed to your Cloudflare account.

Official references: [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/), [local Functions development](https://developers.cloudflare.com/pages/functions/local-development/).

## API and privacy

`POST /api/signup`, `Content-Type: application/json`:

```json
{"steamNick":"xX_MidGod_420_Xx","steamLink":"https://steamcommunity.com/id/example","mmr":5000}
```

Success is `200 {"success":true}`. Errors include a stable translation code: `{ "success": false, "errorCode": "mmr", "error": "Human-readable message" }`, with 400 (validation), 403 (origin), 405 (method), 413 (body too large), 415 (content type), 429 (rate limited), or 503 (storage unavailable). Send `Accept-Language: en` for English errors; Serbian is the default. The UI translates the stable code, so a displayed error also changes language instantly. The optional `website` honeypot must remain empty. Existing payloads and success responses remain compatible; no new migration is needed for the redesign.

Validation: trimmed 1–64-character nick without control characters; HTTPS `steamcommunity.com/id/<vanity>` or `/profiles/<17-digit-id>`, maximum 256 characters, no credentials, nonstandard port, query or fragment; integer MMR 0–20000. Profile URLs are validated structurally, not checked for existence or ownership. SQL uses bound parameters. Request bodies are capped at 4096 bytes while streaming. Cross-origin browser submissions are refused. No GET/list endpoint exposes challengers.

Spam protection: frontend submit lock, honeypot, and atomic D1 UPSERT permitting five valid requests per IP per hour. The IP-derived key is salted and rotated daily; raw IPs are never stored by the app. Rotation at UTC midnight can reset a window early. Expired limiter rows are removed on subsequent successful submissions. This is lightweight abuse protection, not a defense against distributed botnets. For larger traffic, add a Cloudflare edge rate-limit rule for POST `/api/signup` according to your plan. Origin headers are not authentication.

Only Steam Nick, Steam Link, MMR, and creation time are saved with a generated ID. The random survival percentage is cosmetic and never sent to the API. The app has no admin UI. Manage/delete records using the D1 dashboard or authenticated Wrangler. Before wider launch, customize `footer.contactText` and `footer.privacyText` in both content dictionaries with your preferred operator contact and retention policy. Default text directs deletion requests to the person who shared the site. The only browser storage is the `rade-language` preference; form data is not stored in localStorage.

## Checks

```sh
npm test
npm run build
npx wrangler pages functions build --outfile .wrangler/signup-worker.js
```

Tests cover validation, request protections, parameter binding, rate-limit responses, storage failures, dictionary completeness, Serbian Latin text, language persistence, locale-aware numbers, all layout translation keys, stable lore IDs, quote selection, and translated API errors. To verify real persistence locally, submit the form with both dev servers running, then:

```sh
npx wrangler d1 execute DB --local --command "SELECT COUNT(*) AS total FROM challengers"
```

Confirm keyboard navigation, mobile layout, reduced-motion mode, errors, and the seven-stage processing sequence (about 2.7 seconds). Switch language with a partially filled form, an open FAQ, a visible error, during processing, and on success: state and entered values should remain intact. Success and the brief divine-judgment overlay must only appear after a confirmed API response. A timeout warns that the write may already have completed; do not automatically retry POST requests.

## Structure

```text
index.html                        Vite entry, Serbian prerender at build time
src/layout.js                     One semantic layout, all copy referenced by key
src/main.js                       UI state, animation, language switching, API
src/i18n.js                       Dictionaries, safe persistence, number formatting
src/content/sr.js                 Serbian UI, mythology, FAQ and processing copy
src/content/en.js                 Matching English UI and lore
src/content/quotes.js             Global bilingual quotes, triggers and audio metadata
src/content/errors.js             Shared localized validation/API messages
src/quote-engine.js               Accessible, throttled prophecy notifications
src/style.css + src/theme.css     Responsive Egyptian/neon theme and CSS illustrations
src/validation.js                 Shared pure validation with stable error codes
functions/api/signup.js           Pages Function
migrations/0001_create_challengers.sql
public/_headers                   Security headers for static assets
public/_routes.json               Functions run only on /api/*
tests/                            Node built-in API, i18n and content checks
vite.config.js                    Local API proxy and default-language prerender
wrangler.toml                     Pages and D1 configuration
```

## Editing the mythology and future video quotes

All visible copy lives in `src/content/`. Change the same key in `sr.js` and `en.js`; do not copy the page or hard-code translated text into markup. `translations.sr` and `translations.en` are exported by `src/i18n.js`. `npm test` checks both dictionaries for matching keys, nonempty text, and matching lore IDs.

- **FAQ:** append `{ id, question, answer }` to `faq.entries` in each language. Keep IDs and order aligned. New entries automatically become native keyboard-accessible accordions. Use `\n` for line breaks.
- **Mythology:** append `{ id, title, text }` to `mythology.facts` in each language. Cards render automatically.
- **Hero:** edit `hero.rotations` for rotating inscriptions and `hero.badges` for badges.
- **Oracle:** edit `oracle.telemetry` label/value pairs in both dictionaries.
- **Quotes:** add one bilingual object to `src/content/quotes.js`:

```js
{
  id: 'a-stable-video-quote-id',
  sr: 'TAČAN CITAT IZ VIDEA.',
  en: 'THE ENGLISH VERSION.',
  audio: null,
  triggers: ['logo', 'faq', 'oracle', 'myth', 'chess', 'badge', 'decoration']
}
```

The `bezite-nobovi` quote has priority 100 and the `signup` trigger. It appears once per page session on the main CTA or first form interaction, never blocks scrolling, and cannot be interrupted by an ordinary quote. Other quotes are randomized and throttled. Notifications can be dismissed with Escape or their labeled close button; hovering or focusing them pauses dismissal. Language changes update an active quote without creating another notification.

The `rade:quote` document event supplies `{ id, language, audio, trigger }`; `rade:protocol` supplies `{ stage, language }` for processing and outcome events. `audio` is reserved metadata only: **there is no audio playback or loading code**, even if a future editor fills in a path. A future sound module must add explicit user opt-in and handle these events separately.

Animations use a bounded particle count, IntersectionObserver counters, visibility-aware timers, and reduced-motion support. A header control also pauses decorative motion and rotating text. The success overlay is short, noninteractive, and hidden from assistive technology; the permanent result contains the same verdict. Egyptian geometry, the pharaoh, pyramids, Eye motif, and chessboard are CSS/HTML, without external image dependencies. Vite prerenders the Serbian layout and metadata from the same dictionaries; language switching changes text and attributes in place so form values, FAQ expansion and request state survive.
