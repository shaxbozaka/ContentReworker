# Content Reworker

Turn long-form content into a clean LinkedIn post — with hook options, a
personalized viral-ideas feed from creators *you* subscribe to, and a
growing open-source recommender on top.

Hosted at **[aicontentrepurposer.com](https://aicontentrepurposer.com)**.

Open-source on GitHub so you can audit exactly what we do with your
YouTube subscriptions, your liked videos, and the content you paste
in. Nothing is used to train any model. Nothing is sold.

---

## What it does

- Paste an article → get a LinkedIn post draft with 3 hook variants (Gemini 2.5 Flash Lite)
- Connect your YouTube account — we auto-import your subscriptions as "tracked creators"
- A content-ideas feed that ranks videos from those creators by tracked-creator boost, topic overlap with your history, engagement velocity, and your 👍 / 👎 feedback
- Add LinkedIn / Instagram / TikTok / X creators manually (full ingest for those platforms ships via a companion browser extension)
- Fallback-chain AI generation: Gemini → OpenAI → Anthropic, configurable per user

## Tech stack

- **Frontend**: React 18 + Vite + Tailwind + shadcn/ui + wouter (routing) + TanStack Query
- **Backend**: Express + TypeScript (tsx in dev, esbuild bundle in prod)
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: Gemini (2.5 Flash / Flash Lite) via OpenAI-compat endpoint, OpenAI SDK, Anthropic SDK
- **Integrations**: LinkedIn OAuth, Google OAuth (+ YouTube Data API v3), Paddle (billing)
- **Session**: Postgres-backed (connect-pg-simple) with an in-memory LRU cache (custom `TieredSessionStore`)
- **Deploy**: Docker Compose → bare-metal Linux box behind nginx, push-to-deploy via git remote

## Quick start (local)

```bash
git clone https://github.com/shaxbozaka/ContentReworker.git
cd ContentReworker
cp .env.example .env
# Fill in GEMINI_API_KEY at minimum; others are optional for most features
docker compose up -d postgres
npm install
PORT=3000 npm run dev
```

Then open http://localhost:3000.

### Required env vars for a minimal local run

- `DATABASE_URL` — Postgres connection string
- `SESSION_SECRET` — any random 32+ char string
- `GEMINI_API_KEY` — free tier is enough for local dev

### Optional env vars

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` — fallback AI providers (Gemini → OpenAI → Anthropic chain)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI` — Sign in with Google + YouTube import (request `youtube.readonly` scope when bootstrapping)
- `YOUTUBE_API_KEY` — Trending tab + per-channel ingest from tracked accounts
- `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` / `LINKEDIN_REDIRECT_URI` — Sign in with LinkedIn + posting from the repurposer
- `PADDLE_API_KEY` / `PADDLE_CLIENT_TOKEN` / `PADDLE_WEBHOOK_SECRET` / `PADDLE_PRO_MONTHLY_PRICE_ID` / `PADDLE_PRO_ANNUAL_PRICE_ID` — Pro subscriptions
- `ADMIN_EMAILS` — comma-separated list of admin email addresses; gates `GET /api/users`. Leave unset in dev to disable admin routes.
- `TIERED_SESSION_TTL_MS` — in-memory session cache TTL (default 5 min). Lower for stricter session invalidation, higher for fewer DB hits.

See `server/routes.ts` for the full HTTP surface and `shared/schema.ts` for the data model.

## How the recommender works

Score per candidate post:

```
tracked_creator_bonus (5)         if post came from one of your tracked accounts
+ topic_overlap (up to 9)         topics(post) ∩ topics-you've-engaged-with
+ engagement_velocity             log10(views / age_hours)
+ freshness                       gentle decay over 30 days
+ positive_interaction_boost      + weight from your prior 👍 / Use / Copy on this post
- hidden_creator_penalty (50)     if you 👎'd this creator
```

Plus a max-2-per-creator diversity cap so one prolific channel can't dominate your feed.

Full logic: [`server/services/trending.ts → getCuratedVirals`](./server/services/trending.ts).

Topic tagging is done post-ingest via Gemini 2.5 Flash Lite in [`server/services/viral-tagger.ts`](./server/services/viral-tagger.ts) — one API call per new post, ~$0.0001 each.

## Data policy

- We request `youtube.readonly`; subscriptions and liked-video IDs are the only YouTube data we read.
- Data is never used for model training, advertising, or resale. See [our privacy policy](https://aicontentrepurposer.com/privacy-policy) — we adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) including the Limited Use requirements.
- Revoke access any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Security

Self-audited end-to-end before going public. Source-code, infra, and rate-limit posture each ran through three review passes; the running fixes for what surfaced (auth gaps, IDOR, OAuth state CSRF, weak PRNG, cost-inflation rate limits, EOL Node base image, etc.) are squashed into the `security:` commits visible in the log.

Found something? See [SECURITY.md](./SECURITY.md) for the disclosure process.

## Contributing

Open issues + PRs welcome. No CLA, no copyright assignment. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the short version.

## Status

**Phase 1 shipped** — YouTube import, per-user tracked creators, topic-aware recommender, 👍/👎 feedback signals, session-store hardening, full security pass.

**Phase 2 (in progress)** — open-source browser extension (separate repo) for LinkedIn / Instagram / TikTok ingestion via the user's own logged-in session. No paid scraping service, no server-side cookie storage.

**Phase 3 (future)** — pgvector + Gemini embedding-based similarity, creator discovery ("people who track X also track…"), CSRF tokens, Redis-backed rate limiter for multi-replica scaling.

## License

MIT — see [LICENSE](./LICENSE).
