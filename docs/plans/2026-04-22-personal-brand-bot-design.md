# Telegram-Native Personal Brand Bot — Design Doc

**Date:** 2026-04-22
**Status:** Brainstorm complete, ready for implementation plan
**Working name:** TBD (placeholder: `BrandCoach`)
**Repo:** Lives inside the existing ContentReworker monorepo (shares Postgres, Drizzle, Stripe, AI providers, scheduler infrastructure). New code is namespaced under `server/bot/` and `server/services/bot/` — does **not** modify the existing LinkedIn-first web product.

---

## 1. Overview

A Telegram-native AI agent that helps small-business owners and aspiring personal brands build their social media presence — without needing marketing skills, video editing, or a content team.

### Who it's for
Small business owners and personal-brand builders with no marketing background:
- Dental clinics, fitness coaches/gyms, real estate agents, salon owners, lawyers, restaurants, accountants, coaches
- Know their craft, lost on Instagram/TikTok/Facebook
- Have a phone, have stories, no time/skill/clue what works in their industry

### Core promise
> "You film 30 seconds on your phone. I turn it into a viral-ready post — script, viral-pattern edit, captions, b-roll, posting. Every suggestion comes with a real example from a business like yours that's already going viral, so you actually learn what works."

**The product is viral video editing for non-tech business owners.** Not a generic "captioning bot." Bot's value lives in two places: (a) the **viral script + filming direction** (where niche intelligence lives — what hook patterns are going viral right now in *your* niche), and (b) delegating the technical viral edit (word-by-word captions, auto-b-roll, auto-cut, jump cuts, music) to a best-in-class API rather than rebuilding it.

### Why Telegram-first
This audience is intimidated by SaaS dashboards. Chat is universal — they already use Telegram/WhatsApp daily. The bot meets them where they are. The web app demotes to a "preview / review my scheduled posts" surface, not the main UX.

### Differentiators
1. **Coach, not a power tool** — Patient, teaches the *why*, designed for non-marketers
2. **Receipts, not advice** — Every suggestion cites a real post by a similar business in the same niche
3. **Telegram-native UX** — No dashboard fatigue
4. **Filming coach, not video generator** — User builds the skill themselves; bot fills the gaps. They become better, not dependent.

### Anti-promises
- We don't make AI avatars or fake-person videos. The user is the brand.
- We don't post anything publicly without explicit user approval.
- We don't lecture or moralize ("posting daily increases visibility"). We show data and offer to act on it.

---

## 2. User Journey (concrete walkthrough)

**Day 1 — onboarding:**
1. Dr. Aliya (dentist, Tashkent) sees Instagram ad → opens Telegram → bot DMs her
2. Bot: "I help dental clinics grow on Instagram. What's your clinic name and city?"
3. Bot: "Connect your Instagram so I can post for you when you're ready" → OAuth deep link → connected
4. Bot: "Who are you most trying to reach — families, cosmetic patients, professionals?"
5. Bot: "Show me 1–3 dental Instagram accounts you admire" → user pastes 3 handles
6. Bot: "Got it. Want to make your first post now?"

**Day 1 — first post:**
7. Bot: "What's a question patients ALWAYS ask you?" → "How long does whitening last?"
8. Bot generates 30-sec script + filming instructions ("hold phone vertical, stand near a window, look at camera, smile warm — read once before recording")
9. User films on phone, sends raw video back to bot
10. Bot processes (~20s): extract audio → transcribe → align → caption-burn
11. Bot returns preview + caption text + suggested hashtags + suggested posting time
12. User taps `[Schedule Tue 6pm]`
13. Bot: "Locked in. I'll ping you 5 min before publish."

**Day 4 — performance nudge:**
14. Bot: "Your whitening post: 320 views, 5 saves, 1 DM — 2× your average. The 'patients always ask me…' hook works. Want another in this format?"

**Day 7 — gap nudge:**
15. Bot: "Quiet 4 days. You have 1 unfinished script in drafts. Want to film it?"

**Time-to-first-post target:** under 5 minutes from "hi" to scheduled post.

---

## 3. Architecture

### Stack
- **Runtime:** Node + TypeScript + Express (shared with ContentReworker)
- **Bot framework:** `grammy` (modern, TS-first, supports webhooks)
- **Database:** Postgres + Drizzle (shared)
- **AI (text):** Gemini 2.0 Flash (existing; cheap + fast)
- **AI (transcription):** Whisper API or AssemblyAI (faster latency)
- **Video processing:** ffmpeg (server-side caption burn-in, aspect ratio crops)
- **Storage:** R2 / S3 for raw + processed video
- **Cron:** existing scheduler (`server/services/scheduler.ts`)

### Code organization
```
server/
  bot/
    index.ts                # Telegram webhook entry + bot lifecycle
    router.ts               # ChatRouter — parses incoming messages
    intents/                # IntentDetector handlers
      onboarding.ts
      draft.ts
      schedule.ts
      analytics.ts
      callback.ts           # Inline-keyboard button responses
  services/bot/
    content-engine.ts       # Generates platform-native variants
    approval-flow.ts        # Inline-keyboard variant selection
    nudge-engine.ts         # Cron-driven proactive coach
    video-pipeline.ts       # Script → instructions → upload → caption → post
    examples-retriever.ts   # Niche-relevant curated examples lookup
    intent-detector.ts      # LLM classifier for incoming messages
    business-profile.ts     # Niche detection + profile management
  services/platforms/
    base.ts                 # Platform plugin interface
    instagram.ts            # Phase 1
    facebook.ts             # Phase 2
    telegram-channel.ts     # Phase 2 (cheap)
    tiktok.ts               # Phase 3
    youtube-shorts.ts       # Phase 3
    linkedin.ts             # Existing — wrapped in plugin interface
```

### Plugin interface (every platform implements this)
```ts
interface PlatformPlugin {
  id: 'instagram' | 'facebook' | 'tiktok' | 'youtube_shorts' | 'telegram_channel' | 'linkedin';
  styleGuide: PlatformStyleGuide;        // Prompt template, format, length, tone
  postingAdapter: PostingAdapter;        // publish(), uploadMedia(), tokenRefresh()
  analyticsAdapter: AnalyticsAdapter;    // fetchMetrics(postId)
  accountConnector: AccountConnector;    // connectFlow(), exchangeAuthCode()
}
```

Adding a new platform = implement the 4 sub-interfaces and register in a registry. Bot core never references platforms by name.

### Data flow (capture → publish)
```
Telegram message
  → ChatRouter (parses: text, voice, photo, video, forward, callback button)
  → IntentDetector (LLM classifier: draft / schedule / analytics / onboarding / chitchat)
  → Intent handler
    → ContentEngine (calls platform StyleGuide + ExamplesRetriever)
    → ApprovalFlow (sends variants with inline keyboard)
  → User taps button → CallbackHandler
    → Scheduler queue OR PostingAdapter immediate publish
  → Post publishes → AnalyticsCollector cron pulls metrics every 6h
  → NudgeEngine sees fresh performance → next nudge cycle
```

---

## 4. Database Schema (additions to `shared/schema.ts`)

```ts
botUsers
  id, telegramChatId (unique), telegramUsername, name, locale,
  createdAt, lastActiveAt

userBusinessProfile
  userId (fk botUsers), businessName, niche (enum: dental | fitness | real_estate | salon | restaurant | law | accounting | coaching | other),
  city, country, audienceDescription (text),
  inspirationHandles (jsonb: [{platform, handle}]),
  createdAt, updatedAt

platformConnections
  userId, platform, accessToken, refreshToken, expiresAt,
  accountId, accountName, scopes (jsonb), connectedAt

contentJobs                          // The workflow unit
  id, userId, sourceType (text|voice|photo|video|forward),
  sourceContent (text or media URL),
  status (draft | approved | scheduled | published | failed),
  variants (jsonb),                  // [{platform, text, mediaUrl, hookStyle}]
  selectedVariantId, scheduledAt, publishedAt,
  platforms (jsonb: [platform_id]),  // Which platforms this is going to
  postIdsByPlatform (jsonb)          // After publish, store platform post IDs

videoSubmissions                     // Raw uploads tied to content jobs
  id, contentJobId, rawVideoUrl, processedVideoUrl,
  captionsJson, transcriptText, durationSec,
  status (uploaded | processing | ready | failed),
  errorMessage, createdAt, processedAt

nudgeHistory
  id, userId, nudgeType (performance | inventory | calendar | pattern | gap),
  sentAt, message (text), userResponded (bool), responseAt, responseAction

marketExamples                       // Curated library
  id, niche, platform, hookStyle,
  postUrl, postText, mediaUrl,
  performanceNote (text),            // "got 12k views"
  whyItWorks (text),                 // 1-sentence summary
  language, addedBy, addedAt
```

**Note on `botUsers` vs existing `users`:** Keep separate for v1 (cleaner mental model, different product). Add an optional `linkedUserId` column later if we want cross-product features.

---

## 5. Onboarding Flow

5-step bot-only onboarding (no web required):

1. **Greet + niche detect** — Bot asks 1 line about the business. LLM classifies into niche enum. Confirm with user.
2. **Connect platform** — Bot sends a deep link for IG OAuth (or "add me to your Telegram channel as admin").
3. **Audience** — One question: "Who do you most want to reach?"
4. **Inspirations** — "Paste 1–3 accounts in your space you admire."
5. **First action** — "Want to make your first post now?" → straight into content workflow.

**Account linking from web (optional):**
- Web app generates a one-time token
- Opens `t.me/<botname>?start=<token>` in Telegram
- Bot DMs user → user taps "Confirm" → linked

---

## 6. Content Workflow

```
Capture          Generate         Approve          Schedule         Publish         Measure
──────           ────────         ───────          ────────         ───────         ───────
text/voice/      platform-        user picks       suggested        platform        metrics
photo/video      native           variant in       optimal          adapter         pulled
forward          variants         chat (or         time per         publishes       every 6h
                 (with niche      kicks to web     platform                         post-publish
                 examples)        for editing)
```

**Multi-platform output:** When user has multiple platforms connected, ContentEngine produces one variant per platform per content job. User can approve all or selectively.

---

## 7. Nudge Engine

**Run:** Hourly cron evaluates each active user.

**Signals collected per user:**
- `daysSinceLastPost`
- `daysSinceLastBotMessage`
- `unfinishedDraftsCount`
- `scheduledPostsUpcoming`
- `recentPostPerformance` (top performer / underperformer of last 7 days)
- `recentNudgeAngle` (avoid repeats)
- `responseRate` (last 5 nudges)

**Nudge angles (rotate):**
- **Performance** — references a recent winning post + offers to repeat the formula
- **Inventory** — points to unfinished drafts
- **Calendar** — gaps in upcoming schedule
- **Pattern** — "you usually post Tue, nothing this week"

**Quiet rules:**
- No nudge angle repeated within 7 days
- 2 ignored in a row → silent for 5+ days
- Never more than 1 nudge per 24h
- Never between 9pm and 8am user's local time (use `userBusinessProfile.country` to infer)

**Format (always):**
```
[Specific data point about their content/performance]
[Real example from their niche, if available]
[One action button: "Yeah, do it"]
```
No coaching prose. No "consistency is key." Just data + action.

---

## 8. Video Pipeline (Option B+ — viral-edit via Submagic)

```
1. Bot generates 30-sec viral-structured script (Gemini, niche-aware,
   references current viral patterns from inspiration accounts' niche)
   - Hook in first 1.5s, pacing notes, beat count
2. Bot sends filming instructions: framing, lighting, pacing, energy
   ("punch the first line", "pause here", "smile warm here")
3. User films vertical on phone, sends video to bot (Telegram up to ~50MB direct)
4. Bot uploads raw video to R2; kicks off background processing job
5. Submagic API call: word-by-word styled captions + auto-b-roll +
   auto-cut filler/silence + music suggestion. Returns processed MP4.
   (For Russian/Uzbek: AssemblyAI Universal-2 / ElevenLabs Scribe transcription
    + our own caption styling layer, since Submagic is Anglophone-strong.)
6. Bot returns preview + caption text + hashtags + suggested platforms + posting time
7. User approves → schedule or post immediately
```

**Why Submagic (vs building this ourselves):** rebuilding caption styling + b-roll + auto-cut is a 6-month engineering project that won't beat the current SOTA. Submagic API is mature in 2026, ~$0.69/min (~$0.35 per 30-sec video, ~$1.40/user/month at 4 videos), and has a real API designed for n8n/Zapier-style integrations.

**Locale fork:**
- English / Spanish / common Western languages → Submagic full pipeline
- Russian / Uzbek / Central Asian → AssemblyAI or ElevenLabs Scribe transcription + our caption styling (Submagic's caption templates degrade hard on Cyrillic/Turkic). This is also our **moat** — no Western tool serves these markets well in 2026.

**Locked product principle:** No AI avatars, ever. The user is the brand. Bot generates a viral *edit treatment* for the user's real face/voice; it never replaces the user with synthetic media.

**Latency target:** 20–30 seconds from upload to preview. Bot shows progress ("transcribing...", "picking b-roll...", "rendering...") so the wait feels active.

---

## 9. Curated Examples Library — "viral video patterns by niche"

The library isn't just "good posts." It's **viral patterns** that the bot can teach + replicate: hook structure, beat count, b-roll types, caption styles that top creators in each niche are using *right now*.

**v1 sourcing (manual):**
- Hand-pick 100 IG/TikTok/Reels posts per launch niche (3 niches → ~300 posts)
- For each: niche, platform, **hook pattern** ("question hook," "controversial claim," "before/after reveal"), beat count (e.g., "4-beat: hook → setup → reveal → CTA"), b-roll style, performance note, why it worked (1-sentence), language
- Stored in `marketExamples`; lightweight admin UI to add/edit
- Hire a part-time researcher if needed; refresh monthly (viral patterns decay)

**v2 sourcing (automated, post-launch):**
- Aggregate from our own users' published posts (anonymized)
- Posts performing 2× above niche average auto-added to library
- Compounds over time as user base grows

**Retrieval:**
- Bot queries `marketExamples` filtered by user's niche + relevant hook style
- Returns top 3 by recency + performance
- Cited inline in nudges and variant suggestions

---

## 10. Phasing & Timeline

### Phase 1 — MVP (~6 weeks)
- Bot scaffold, Telegram webhook, intent router (`grammy`)
- Onboarding flow, business profile, niche detection
- Instagram OAuth + posting adapter
- Video pipeline (script → instructions → upload → caption → post)
- Basic nudge engine (gap + performance angles)
- Curated examples for **dental + fitness** (200 posts total)
- Admin UI for adding examples

### Phase 2 — multi-platform (~3 weeks)
- **Real estate** niche + 100 examples
- Facebook posting adapter
- Telegram channel posting adapter (cheap addition)
- Scheduler refinements + AnalyticsCollector cron

### Phase 3 — short-form video (~4 weeks)
- TikTok + YouTube Shorts adapters
- Cross-platform variant generation in one job
- Pipeline mode (autonomous content cadence with daily approval prompts)

---

## 11. Open Questions / Risks

- **Instagram Graph API approval** — Meta requires Business verification + app review for posting permissions. 2–6 week lead time. **Action: start the application immediately, in parallel with build.** Design assumes approval comes through.
- **Niche coverage** — Bot is only as good as its examples library. Curating 200 high-quality posts before launch is non-trivial. Consider a part-time researcher.
- **Video latency** — 20–30s processing is at the edge of acceptable. May need AssemblyAI Nano (faster) or accept ~60s with strong progress UI.
- **Brand name** — TBD. Needs to land before any public launch.
- **Localization** — Tashkent dental clinic ≠ Austin dental clinic. v1 likely English + Russian (existing user base). Niche style guides may need locale variants.
- **Pricing** — Deferred per user request. Build first, monetize later.
- **Telegram chat ID security** — Anyone could spoof a chat_id in API calls. Always verify via Telegram-signed webhook payload, never trust client claims.
