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

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` — fallback AI providers
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI` — for Sign in with Google + YouTube import
- `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` — for Sign in with LinkedIn + publishing
- `YOUTUBE_API_KEY` — for trending tab + tracked-channel ingestion
- `PADDLE_API_KEY` / `PADDLE_CLIENT_TOKEN` — for Pro subscriptions

See `server/routes.ts` for the full surface.

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

## Contributing

Open issues + PRs welcome. No CLA, no copyright assignment.

Branching: main is deployable. Feature branches merge via PR; we keep the history mostly linear.

If you're adding a new AI provider, new social integration, or a new ranking signal, open an issue first so we can talk through the schema implications.

## Status

Phase 1 shipped: YouTube import + per-user tracked creators + topic-aware recommender + 👍/👎 feedback + per-tenant ranking.

Phase 2 (in progress): [open-source browser extension](https://github.com/shaxbozaka) for LinkedIn / Instagram / TikTok ingestion via the user's own logged-in session (so no paid scraping service, no server-side session storage).

Phase 3 (future): pgvector + embedding-based similarity, creator discovery ("people who track X also track…"), explicit preference refinement.

## License

MIT — see [LICENSE](./LICENSE).
