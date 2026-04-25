# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other AI agents working in this repo.

## Project overview

Content Reworker turns long-form content into a clean LinkedIn post — with hook
options, a personalized viral-ideas feed pulled from creators the user
subscribes to on YouTube (and later, via the open-source extension, on
LinkedIn / Instagram / TikTok), and a topic-aware recommender that learns
from 👍 / 👎 feedback.

- **Live**: https://aicontentrepurposer.com
- **Repo**: https://github.com/shaxbozaka/ContentReworker (public, MIT)
- **Status**: Phase 1 shipped (YouTube ingest + recommender). Phase 2 in progress (browser extension).

## Development commands

```bash
npm run dev          # tsx server/index.ts (Express + Vite middleware)
npm run build        # Vite client bundle + esbuild server bundle
npm run start        # production: node dist/index.js
npm run check        # tsc --noEmit
npm test             # vitest run
npm run db:push      # drizzle-kit push (apply schema → DB)
```

Local dev server runs on `PORT=3000` (macOS AirPlay holds 5000). Production binds to `:5000` inside the container, `127.0.0.1:5000` on the host, fronted by nginx + Cloudflare DNS.

## Docker

```bash
docker compose up -d postgres   # local dev: just the DB, then `npm run dev`
docker compose up -d             # full stack (rarely used locally)
docker compose build app && docker compose up -d app   # rebuild + redeploy
docker compose logs app --tail=50
```

Postgres on `127.0.0.1:5433` (local) and `127.0.0.1:5433` (prod). App container on prod uses `127.0.0.1:5000`.

## Architecture

### Stack

- **Frontend**: React 18 + Vite + Tailwind + shadcn/ui + wouter (routing) + TanStack Query
- **Backend**: Express + TypeScript via tsx (dev), esbuild bundle (prod)
- **DB**: PostgreSQL via Drizzle ORM (`shared/schema.ts` is the source of truth)
- **AI**: Gemini `2.5-flash-lite` (primary; chosen because `2.0-flash` has 0 free-tier quota for our project and `2.5-flash` throws transient 503s). OpenAI + Anthropic in the fallback chain. Topic tagging uses the same Gemini model via the OpenAI-compatible endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/`.
- **Auth**: Google OAuth (with optional `youtube.readonly` scope for YouTube import), LinkedIn OAuth, username/password (bcrypt). Sessions are Postgres-backed via `connect-pg-simple`, fronted by an in-process LRU cache (`server/services/tiered-session-store.ts`).
- **Billing**: Paddle (live keys; webhook signature verified via HMAC + timing-safe compare).
- **Headers**: helmet middleware for HSTS / Referrer-Policy / X-Content-Type-Options / X-Frame-Options. CSP intentionally off until tuned.

### Directory layout

```
client/
  src/
    pages/           home, trending (Ideas), creators, accounts, pricing,
                     schedule, history, generate, privacy-policy, terms-of-service
    components/
      ui/            shadcn/ui primitives
      *.tsx          ContentRepurposer, PlatformOutput, AppHeader, Footer, etc.
    context/         ContentContext (repurposer state), AuthContext
    lib/             queryClient (apiRequest helper), analytics
server/
  index.ts           Express setup, helmet, sessions, vite middleware in dev
  routes.ts          ALL HTTP routes (~3000 lines; grep your way around)
  db.ts              Drizzle pool + db handle
  storage.ts         DB read/write helpers
  middleware/
    auth.ts          requireAdmin (admin gate), regenerateSession (session-fixation defence)
  services/
    gemini.ts        Gemini repurpose + carousel-style generation (carousel removed)
    openai.ts        OpenAI fallback
    anthropic.ts     Anthropic fallback
    google-auth.ts   Google OAuth (login + youtube.readonly scope variant)
    linkedin.ts      LinkedIn OAuth + posting
    trending.ts      Trending content (HN/Reddit/YouTube), curatedVirals storage,
                     getCuratedVirals = the recommender
    scrapers/youtube.ts        Per-channel ingest via YouTube Data API v3
    competitor-ingest.ts       Orchestrator: walks tracked_accounts, calls scraper, upserts
    viral-tagger.ts            Gemini-powered topic tagging (3-5 kebab-case tags per post)
    youtube-bootstrap.ts       OAuth callback hook: import subscriptions + liked videos
    tiered-session-store.ts    LRU cache wrapping connect-pg-simple
    scheduler.ts               Background scheduled-posts job
    pipeline-scheduler.ts      Background content-pipeline job
shared/schema.ts     Drizzle tables + Zod schemas. RUN `npm run db:push` after edits.
```

### Recommender (Phase 1)

`server/services/trending.ts:getCuratedVirals` — score per candidate post:

```
+ trackedCreator       (5)        if post.tracked_account_id ∈ user's accounts
+ topic_overlap        (up to 9)  topics(post) ∩ topic-weights from user's positive interactions
+ engagement_velocity  (×0.5)     log10(views / max(1, age_hours))
+ freshness            (1)        gentle decay over 30 days
+ positive_interaction (×0.4)     extra weight when this user already 👍/used/copied this post
- hidden_creator       (50)       if user 👎'd this creator
```

Plus a max-2-per-creator diversity cap. Tags come from `viral-tagger.ts` (one Gemini call per ingested post). Anonymous users fall back to plain views-sorted.

### Key API endpoints

```
POST /api/repurpose                    # core: generate LinkedIn post + hooks
POST /api/repurpose/regenerate         # regenerate single platform output

GET  /api/auth/me                      # current session user
GET  /api/auth/google                  # OAuth URL (login only)
GET  /api/auth/google/youtube          # OAuth URL with youtube.readonly scope
GET  /api/auth/google/callback         # validates state, persists tokens, kicks off YT import
GET  /api/auth/linkedin/login + /callback
POST /api/users/register | login | logout

GET  /api/users                        # admin only (requireAdmin middleware)
GET  /api/users/:userId/social-connections

GET  /api/tracked-accounts             # user's tracked creators per platform
POST /api/tracked-accounts             # add one
DELETE /api/tracked-accounts/:id
POST /api/tracked-accounts/:id/refresh # ingest now (rate-limited)
POST /api/integrations/youtube/import  # manual re-sync of subs

GET  /api/preferences | PUT /api/preferences   # niche/topics/audience/languages

POST /api/viral/:id/interaction        # record view/use/copy/like/hide
POST /api/viral/ingest                 # 501 stub — Phase 2 browser-extension target

GET  /api/trending/curated             # the Ideas feed (passes session userId to ranker)
POST /api/trending/refresh             # rate-limited; refreshes HN/Reddit/YT trending
POST /api/trending/seed-curated        # rate-limited

POST /api/billing/checkout             # Paddle checkout session
POST /api/billing/webhook              # Paddle webhook (raw body, HMAC verified)
POST /api/billing/portal               # Paddle billing portal URL
```

Rate limiters live at the top of `server/routes.ts`:
- `repurposeIpLimiter` — 20/IP/hour
- `loginIpLimiter` — 10/IP/15 min, skips successful logins
- `registerIpLimiter` — 5/IP/hour
- `expensiveApiLimiter` — 30/IP/hour for the trending refresh / tracked-account refresh / YT import endpoints

### Database schema highlights

- **users**: id, username, password (bcrypt), email, googleId, googleAccessToken, googleRefreshToken, googleTokenExpiry, googleScopes, linkedinId, plan, paddleCustomerId, paddleSubscriptionId, …
- **tracked_accounts**: per-user creator handles per platform with `source` (manual / youtube_subscription / instagram_following / …)
- **curated_virals**: ingested posts, includes mediaType + videoUrl + thumbnailUrl + duration + platformPostId + trackedAccountId + topics (json) + topicsTaggedAt
- **viral_interactions**: feedback signals per (user, viral, action) with weight column
- **user_content_preferences**: niche / target_audience / content_goal / topics[] / languages[]
- **trending_content**: HN/Reddit/YouTube generic trending (legacy; Trending tab data source)
- **transformations** + **transformation_outputs**: repurpose history (per-user-scoped now after C2 fix)
- **scheduled_posts**, **content_pipelines**, **pipeline_drafts**: scheduled-posting / pipeline features
- **hook_analytics**: hook performance tracking
- **user_sessions**: connect-pg-simple table (auto-created)

## Conventions

### Commit messages
- Format: `<area>: <imperative summary>` then a body explaining *why*, not what.
- Common areas: `feat`, `fix`, `security`, `docs`, `chore`, `perf`, `refactor`.
- **Don't** add `Co-Authored-By: Claude …` trailers. Author commits as the user only.

### Before committing
1. `npm run check` — typecheck must pass; no warnings ignored
2. `npm test` — all green
3. Read your own diff (`git diff --stat`, `git diff <file>`) like a reviewer

### Schema changes
1. Edit `shared/schema.ts`
2. `npm run db:push` (drizzle-kit applies the diff)
3. If drizzle-kit asks "renamed from X?" — answer "+ create" unless you know it's a rename; renames preserve data
4. On prod: `ssh liza "docker compose exec -T app sh -c 'npx drizzle-kit push --config=drizzle.config.ts'"`

### Adding a new route
1. Add it to `server/routes.ts` near siblings (auth → next to other auth routes, billing → near Paddle handlers)
2. Always call `ensureUserId(req)` for state-changing routes; for read routes, gate with `req.session.userId` if data is user-scoped
3. Double-check ownership when accepting `:id` params — the IDOR-fix pattern is `if (row.userId !== req.session.userId) return 404`
4. Apply a rate limiter if the endpoint is expensive or auth-adjacent

### Adding a new AI provider
- Implement in `server/services/<provider>.ts` matching the existing shape (`repurposeContent(input) → outputs`)
- Wire into `getProviderFallbackOrder` in `server/routes.ts`
- Update `aiProviders` enum in `shared/schema.ts`

### Things that have been removed (don't reintroduce)
- **Stripe billing** → replaced by Paddle. References to Stripe in code are dead.
- **LinkedIn carousel feature** (PDF carousel, slide editor, image generation for slides) → removed entirely on 2026-04-24.
- **Old generic trending firehose UI** → kept the API for now but not surfaced; Ideas page is the user-personalized recommender feed.

### Things that are currently deferred (see SECURITY.md / README roadmap)
- CSRF token middleware (SameSite=Lax covers the common cases for now)
- Multi-replica scaling (rate-limit store + tiered-session-store both assume single replica)
- drizzle-orm 0.39 → 0.45 major upgrade (high-severity CVE; not exploitable in our code paths but worth doing)
- Email + password reset flow (not built yet — Nodemailer + bcrypt are in deps when ready)
- Browser extension for LinkedIn / Instagram / TikTok ingest (Phase 2)

## Production access

- App lives at `/root/ContentReworker/` on host `liza` (91.99.27.70)
- Deploy = `git push production main`. Push triggers `updateInstead` policy on the bare-ish server checkout. Then SSH and `docker compose build app && docker compose up -d app` to rebuild the container.
- Postgres: `docker exec contentreworker-postgres-1 psql -U contentreworker -d contentreworker_prod`
- Logs: `ssh liza "docker compose -f /root/ContentReworker/docker-compose.yml logs app --tail=100"`

## Reading order for new contributors / agents

1. `README.md` — what the product is + quick start
2. `SECURITY.md` — disclosure policy
3. `shared/schema.ts` — the data model
4. `server/routes.ts` — every HTTP endpoint
5. `server/services/trending.ts:getCuratedVirals` — the recommender
6. `client/src/pages/home.tsx` + `creators.tsx` + `trending.tsx` — the three main user-facing routes
