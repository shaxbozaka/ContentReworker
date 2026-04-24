# BrandCoach Bot — Phase 1a Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up the Telegram bot, conversational onboarding, business profile storage, and niche detection — enough to onboard a real test user end-to-end via Telegram and persist their profile.

**Architecture:** New code lives under `server/bot/` and `server/services/bot/` to keep it isolated from the existing LinkedIn-first product. Uses `grammy` for Telegram, mounted on the existing Express server via webhook (no polling). Shares the existing Postgres + Drizzle setup. Adds `vitest` for tests on the logic-heavy pieces (intent classification, niche detection, onboarding state machine). External API integrations (Telegram, future IG) get smoke-tested manually rather than mocked, since v1 fakery would not catch the real failure modes.

**Tech Stack:** Node 20, TypeScript (ESM), Express 4, grammy, Drizzle ORM, Postgres, Gemini (`@google/generative-ai`), vitest.

**Reference design:** `docs/plans/2026-04-22-personal-brand-bot-design.md` — read it before starting if you have no context. Locked product principles are in the project memory entry "BrandCoach Bot — new product line."

**Out of scope for this plan (later sub-plans):** Instagram OAuth + posting adapter, video pipeline, nudge engine, examples library, admin UI, scheduler. This plan is foundation only.

---

## Pre-flight

Before any task: confirm you are in the right worktree (run `git worktree list` and check the current path). All commits land on a feature branch, never directly on `main`.

If running this in a worktree: the path is `<repo>/.worktrees/brandcoach-foundation` (or wherever the parent agent created it). All file paths in this plan are relative to that worktree root.

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install runtime + dev deps**

Run:
```bash
npm install grammy
npm install --save-dev vitest @vitest/ui
```

Expected: `package.json` updated with `grammy` in dependencies and `vitest`, `@vitest/ui` in devDependencies. `package-lock.json` updated.

**Step 2: Add scripts to package.json**

Add to the `scripts` object in `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

**Step 3: Sanity check**

Run: `npx vitest --version`
Expected: Prints vitest version (1.x or 2.x). No errors.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(bot): add grammy and vitest for Telegram bot foundation"
```

---

## Task 2: Vitest config

**Files:**
- Create: `vitest.config.ts`

**Step 1: Write config**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'client'],
  },
});
```

**Step 2: Verify it runs (with no tests yet)**

Run: `npm test`
Expected: vitest reports "No test files found" — exits cleanly.

**Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore(bot): vitest config scoped to server and shared"
```

---

## Task 3: Add Drizzle schema for `botUsers`

**Files:**
- Modify: `shared/schema.ts` (append at end of file, before existing relations/exports if any)

**Step 1: Add the table**

In `shared/schema.ts`, add:

```ts
import { pgTable, serial, varchar, text, timestamp, jsonb, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
// (Reuse imports already present in file; only add what's missing.)

export const botUsers = pgTable('bot_users', {
  id: serial('id').primaryKey(),
  telegramChatId: varchar('telegram_chat_id', { length: 64 }).notNull().unique(),
  telegramUsername: varchar('telegram_username', { length: 64 }),
  name: varchar('name', { length: 128 }),
  locale: varchar('locale', { length: 8 }).default('en'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
});

export type BotUser = typeof botUsers.$inferSelect;
export type NewBotUser = typeof botUsers.$inferInsert;
```

**Step 2: Push schema**

Run: `npm run db:push`
Expected: drizzle-kit prompts confirmation; type `y` if needed. Output shows `bot_users` table created. No errors.

**Step 3: Verify in DB**

Run: `psql "$DATABASE_URL" -c "\d bot_users"` (or equivalent for your DB connection).
Expected: shows columns id, telegram_chat_id, telegram_username, name, locale, created_at, last_active_at. `telegram_chat_id` is unique.

If `psql` isn't available, run a one-off Node check:
```bash
npx tsx -e "import {db} from './server/db'; import {botUsers} from './shared/schema'; db.select().from(botUsers).then(r => console.log('rows:', r.length)).catch(e => {console.error(e); process.exit(1)})"
```
Expected: prints `rows: 0`.

**Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(bot): add botUsers table for Telegram-first product line"
```

---

## Task 4: Add `niche` enum and `userBusinessProfile` table

**Files:**
- Modify: `shared/schema.ts`

**Step 1: Add niche enum + table**

```ts
export const nicheEnum = pgEnum('bot_niche', [
  'dental',
  'fitness',
  'real_estate',
  'salon',
  'restaurant',
  'law',
  'accounting',
  'coaching',
  'other',
]);

export const userBusinessProfile = pgTable('user_business_profile', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => botUsers.id, { onDelete: 'cascade' }).unique(),
  businessName: varchar('business_name', { length: 256 }),
  niche: nicheEnum('niche').notNull(),
  city: varchar('city', { length: 128 }),
  country: varchar('country', { length: 64 }),
  audienceDescription: text('audience_description'),
  inspirationHandles: jsonb('inspiration_handles').$type<Array<{ platform: string; handle: string }>>().default([]),
  onboardingComplete: boolean('onboarding_complete').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type UserBusinessProfile = typeof userBusinessProfile.$inferSelect;
export type NewUserBusinessProfile = typeof userBusinessProfile.$inferInsert;
```

**Step 2: Push schema**

Run: `npm run db:push`
Expected: enum `bot_niche` and table `user_business_profile` created.

**Step 3: Verify the FK works**

Run:
```bash
npx tsx -e "
import {db} from './server/db';
import {botUsers, userBusinessProfile} from './shared/schema';
const [u] = await db.insert(botUsers).values({telegramChatId: 'test-fk-1'}).returning();
const [p] = await db.insert(userBusinessProfile).values({userId: u.id, niche: 'dental'}).returning();
console.log('inserted profile', p.id, 'for user', u.id);
await db.delete(botUsers).where({id: u.id} as any);
console.log('cleaned up');
"
```
(If the cleanup syntax is wrong for the Drizzle version, use `eq(botUsers.id, u.id)` from `drizzle-orm`.)

Expected: prints `inserted profile X for user Y` and `cleaned up`. The cascade deletes the profile too.

**Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(bot): add niche enum and userBusinessProfile table"
```

---

## Task 5: Add onboarding session state table

We need to remember where in the 5-question onboarding flow each user is, between Telegram messages.

**Files:**
- Modify: `shared/schema.ts`

**Step 1: Add table**

```ts
export const onboardingSessions = pgTable('onboarding_sessions', {
  userId: integer('user_id').primaryKey().references(() => botUsers.id, { onDelete: 'cascade' }),
  step: varchar('step', { length: 32 }).notNull(),  // 'await_business' | 'await_audience' | 'await_inspirations' | 'done'
  pendingProfile: jsonb('pending_profile').$type<Partial<NewUserBusinessProfile>>().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Step 2: Push and verify**

Run: `npm run db:push`
Expected: `onboarding_sessions` table created.

**Step 3: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(bot): add onboarding_sessions table for conversation state"
```

---

## Task 6: Bot module skeleton + grammy init

**Files:**
- Create: `server/bot/index.ts`
- Create: `server/bot/router.ts`

**Step 1: Create the bot instance**

`server/bot/index.ts`:

```ts
import { Bot, webhookCallback } from 'grammy';
import type { Context } from 'grammy';
import { handleUpdate } from './router';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set');
}

export const bot = new Bot<Context>(token);

bot.on('message', handleUpdate);
bot.on('callback_query', handleUpdate);

bot.catch((err) => {
  console.error('[bot] uncaught error:', err);
});

export const telegramWebhookHandler = webhookCallback(bot, 'express');
```

**Step 2: Stub the router**

`server/bot/router.ts`:

```ts
import type { Context } from 'grammy';

export async function handleUpdate(ctx: Context): Promise<void> {
  if (ctx.message?.text) {
    await ctx.reply(`echo: ${ctx.message.text}`);
    return;
  }
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }
}
```

**Step 3: Type-check**

Run: `npm run check`
Expected: no errors related to the new files. (Pre-existing errors in unrelated files are OK — note them but don't fix here.)

**Step 4: Commit**

```bash
git add server/bot/index.ts server/bot/router.ts
git commit -m "feat(bot): grammy bot scaffold with echo router"
```

---

## Task 7: Mount webhook on Express

**Files:**
- Modify: `server/routes.ts` (add one route registration)
- Modify: `.env.example` (or create) — document the new env vars

**Step 1: Read existing routes file structure**

Run: `head -60 server/routes.ts`
Expected: see how routes are registered (likely `app.post(...)` patterns or a router object). Match the existing convention.

**Step 2: Add the webhook route**

In `server/routes.ts`, near the top with other route registrations, add (adjust to match existing style — function-based vs router-based):

```ts
import { telegramWebhookHandler } from './bot';

// ... inside the registration function ...
app.post('/api/bot/telegram/webhook', telegramWebhookHandler);
```

**Step 3: Document env vars**

If `.env.example` exists, append:
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```
If it doesn't exist, create it with these lines plus a header comment:
```
# Telegram bot (BrandCoach product line)
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

**Step 4: Type-check**

Run: `npm run check`
Expected: no new errors.

**Step 5: Commit**

```bash
git add server/routes.ts .env.example
git commit -m "feat(bot): mount Telegram webhook at /api/bot/telegram/webhook"
```

---

## Task 8: Manual smoke test — echo bot end-to-end

This task is **not** TDD. We need to confirm a real Telegram message round-trips.

**Step 1: Get a bot token**

If you don't already have one, ask the user to:
1. Open Telegram, message `@BotFather`, run `/newbot`, follow prompts, get a token
2. Paste the token into `.env` as `TELEGRAM_BOT_TOKEN=...`

**Step 2: Start ngrok**

Run (in a separate terminal, in the background):
```bash
ngrok http 5000
```
Expected: ngrok prints a public HTTPS URL like `https://abc123.ngrok-free.app`. Copy it.

If ngrok isn't installed, ask the user to install it (`brew install ngrok`) and authenticate.

**Step 3: Set the Telegram webhook**

Run:
```bash
NGROK_URL="<paste from above>"
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=${NGROK_URL}/api/bot/telegram/webhook"
```
Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`

**Step 4: Start the dev server**

Run: `npm run dev`
Expected: server boots on port 5000. No errors mentioning `TELEGRAM_BOT_TOKEN`.

**Step 5: Send a test message**

In Telegram, message your bot: `hello`
Expected: bot replies `echo: hello` within 2 seconds.

**Step 6: Document the test result**

If it worked, no commit needed (no code changed). If it failed, debug, fix, commit the fix as `fix(bot): <description>`.

**Pause here.** Confirm with the user that the echo round-trip works before moving on. The next tasks build on this assumption being true.

---

## Task 9: Niche detection (TDD)

**Files:**
- Create: `server/services/bot/niche-detector.ts`
- Create: `server/services/bot/niche-detector.test.ts`

**Step 1: Write the failing test**

`server/services/bot/niche-detector.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectNiche } from './niche-detector';

describe('detectNiche', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a known niche for a clear input', async () => {
    const fakeLlm = vi.fn().mockResolvedValue('dental');
    const result = await detectNiche('I run a dental clinic in Tashkent', { llm: fakeLlm });
    expect(result).toBe('dental');
  });

  it('returns "other" when LLM returns garbage', async () => {
    const fakeLlm = vi.fn().mockResolvedValue('not a real niche');
    const result = await detectNiche('I sell rocks', { llm: fakeLlm });
    expect(result).toBe('other');
  });

  it('lowercases and trims LLM output before validating', async () => {
    const fakeLlm = vi.fn().mockResolvedValue('  Fitness  ');
    const result = await detectNiche('I coach CrossFit', { llm: fakeLlm });
    expect(result).toBe('fitness');
  });

  it('passes the user message in the prompt', async () => {
    const fakeLlm = vi.fn().mockResolvedValue('law');
    await detectNiche('immigration lawyer', { llm: fakeLlm });
    const promptArg = fakeLlm.mock.calls[0][0] as string;
    expect(promptArg).toContain('immigration lawyer');
  });
});
```

**Step 2: Run the test to see it fail**

Run: `npm test -- niche-detector`
Expected: FAIL — `Cannot find module './niche-detector'`.

**Step 3: Implement**

`server/services/bot/niche-detector.ts`:

```ts
const KNOWN_NICHES = [
  'dental',
  'fitness',
  'real_estate',
  'salon',
  'restaurant',
  'law',
  'accounting',
  'coaching',
  'other',
] as const;

export type Niche = (typeof KNOWN_NICHES)[number];

export type LlmFn = (prompt: string) => Promise<string>;

export interface DetectNicheOptions {
  llm: LlmFn;
}

const PROMPT = (userMessage: string) => `
You are classifying a small business owner's description into one of these niches:
${KNOWN_NICHES.join(', ')}.

Respond with ONLY the niche name, no other text.

Business description: "${userMessage}"
`.trim();

export async function detectNiche(userMessage: string, opts: DetectNicheOptions): Promise<Niche> {
  const raw = await opts.llm(PROMPT(userMessage));
  const cleaned = raw.trim().toLowerCase();
  if ((KNOWN_NICHES as readonly string[]).includes(cleaned)) {
    return cleaned as Niche;
  }
  return 'other';
}
```

**Step 4: Run the test to see it pass**

Run: `npm test -- niche-detector`
Expected: 4 tests passing.

**Step 5: Commit**

```bash
git add server/services/bot/niche-detector.ts server/services/bot/niche-detector.test.ts
git commit -m "feat(bot): niche detector with LLM-driven classification"
```

---

## Task 10: Wire niche detector to Gemini

**Files:**
- Create: `server/services/bot/llm.ts`

**Step 1: Read existing Gemini service**

Run: `head -50 server/services/gemini.ts`
Expected: see how the existing project calls Gemini. Reuse that pattern.

**Step 2: Implement a thin wrapper**

`server/services/bot/llm.ts`:

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[bot/llm] GEMINI_API_KEY not set — bot LLM calls will fail at runtime');
}

const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function callLlm(prompt: string, opts: { model?: string; temperature?: number } = {}): Promise<string> {
  if (!client) throw new Error('GEMINI_API_KEY is not configured');
  const model = client.getGenerativeModel({
    model: opts.model ?? 'gemini-2.0-flash',
    generationConfig: { temperature: opts.temperature ?? 0.2 },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

**Step 3: Type-check**

Run: `npm run check`
Expected: no new errors.

**Step 4: No tests yet** (this is a thin adapter over an external API; it will be exercised through niche-detector and onboarding tests as they integrate).

**Step 5: Commit**

```bash
git add server/services/bot/llm.ts
git commit -m "feat(bot): Gemini LLM wrapper for bot services"
```

---

## Task 11: Onboarding state machine — pure logic (TDD)

The state machine is a pure function: `(currentState, userMessage) → (nextState, replyToSend)`. Easy to test in isolation.

**Files:**
- Create: `server/services/bot/onboarding.ts`
- Create: `server/services/bot/onboarding.test.ts`

**Step 1: Write failing tests**

`server/services/bot/onboarding.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { stepOnboarding, type OnboardingState } from './onboarding';

const fakeNicheDetector = vi.fn();

describe('stepOnboarding', () => {
  it('greets a brand-new user and asks the first question', async () => {
    const result = await stepOnboarding(
      { step: 'new', pendingProfile: {} },
      'hello',
      { detectNiche: fakeNicheDetector },
    );
    expect(result.nextState.step).toBe('await_business');
    expect(result.reply).toMatch(/clinic|business|what.*do you/i);
  });

  it('captures business name + city, detects niche, advances', async () => {
    fakeNicheDetector.mockResolvedValueOnce('dental');
    const result = await stepOnboarding(
      { step: 'await_business', pendingProfile: {} },
      'Smile Tashkent dental clinic in Tashkent',
      { detectNiche: fakeNicheDetector },
    );
    expect(result.nextState.step).toBe('await_audience');
    expect(result.nextState.pendingProfile.niche).toBe('dental');
    expect(result.nextState.pendingProfile.businessName).toBeTruthy();
    expect(result.reply).toMatch(/audience|reach|patients/i);
  });

  it('captures audience and asks for inspiration accounts', async () => {
    const result = await stepOnboarding(
      { step: 'await_audience', pendingProfile: { niche: 'dental' } },
      'cosmetic patients and families',
      { detectNiche: fakeNicheDetector },
    );
    expect(result.nextState.step).toBe('await_inspirations');
    expect(result.nextState.pendingProfile.audienceDescription).toBe('cosmetic patients and families');
    expect(result.reply).toMatch(/admire|inspiration|accounts/i);
  });

  it('captures inspiration handles and finishes onboarding', async () => {
    const result = await stepOnboarding(
      { step: 'await_inspirations', pendingProfile: { niche: 'dental', audienceDescription: 'families' } },
      '@drsmiles, @perfect_dental_uz, @straight_teeth_co',
      { detectNiche: fakeNicheDetector },
    );
    expect(result.nextState.step).toBe('done');
    expect(result.nextState.pendingProfile.inspirationHandles).toHaveLength(3);
    expect(result.reply).toMatch(/done|first post|ready/i);
  });

  it('parses handles tolerantly (with or without @, comma or newline separated)', async () => {
    const result = await stepOnboarding(
      { step: 'await_inspirations', pendingProfile: { niche: 'fitness' } },
      'drsmiles\nperfect_dental_uz, @straight_teeth_co',
      { detectNiche: fakeNicheDetector },
    );
    expect(result.nextState.pendingProfile.inspirationHandles).toEqual([
      { platform: 'instagram', handle: 'drsmiles' },
      { platform: 'instagram', handle: 'perfect_dental_uz' },
      { platform: 'instagram', handle: 'straight_teeth_co' },
    ]);
  });
});
```

**Step 2: Run to see failure**

Run: `npm test -- onboarding`
Expected: FAIL — `Cannot find module './onboarding'`.

**Step 3: Implement**

`server/services/bot/onboarding.ts`:

```ts
import type { Niche } from './niche-detector';

export type OnboardingStep = 'new' | 'await_business' | 'await_audience' | 'await_inspirations' | 'done';

export interface OnboardingState {
  step: OnboardingStep;
  pendingProfile: {
    businessName?: string;
    niche?: Niche;
    city?: string;
    audienceDescription?: string;
    inspirationHandles?: Array<{ platform: string; handle: string }>;
  };
}

export interface StepDeps {
  detectNiche: (msg: string) => Promise<Niche>;
}

export interface StepResult {
  nextState: OnboardingState;
  reply: string;
}

export async function stepOnboarding(
  state: OnboardingState,
  message: string,
  deps: StepDeps,
): Promise<StepResult> {
  const trimmed = message.trim();

  switch (state.step) {
    case 'new':
      return {
        nextState: { ...state, step: 'await_business' },
        reply: "Hi! I help small businesses grow on social media. What's your business name and city?",
      };

    case 'await_business': {
      const niche = await deps.detectNiche(trimmed);
      const { businessName, city } = parseBusinessAndCity(trimmed);
      return {
        nextState: {
          step: 'await_audience',
          pendingProfile: { ...state.pendingProfile, businessName, city, niche },
        },
        reply: 'Got it. Who are you most trying to reach — what kind of audience or patients?',
      };
    }

    case 'await_audience':
      return {
        nextState: {
          step: 'await_inspirations',
          pendingProfile: { ...state.pendingProfile, audienceDescription: trimmed },
        },
        reply: 'Perfect. Show me 1–3 Instagram accounts in your space you admire (paste handles).',
      };

    case 'await_inspirations': {
      const handles = parseHandles(trimmed);
      return {
        nextState: {
          step: 'done',
          pendingProfile: { ...state.pendingProfile, inspirationHandles: handles },
        },
        reply: "All set. Want to make your first post now? Just tell me what you'd like to talk about.",
      };
    }

    case 'done':
      return {
        nextState: state,
        reply: "You're already onboarded. Tell me what you'd like to post about.",
      };
  }
}

function parseBusinessAndCity(input: string): { businessName: string; city?: string } {
  const inMatch = input.match(/(.+?)\s+in\s+(.+)$/i);
  if (inMatch) {
    return { businessName: inMatch[1].trim(), city: inMatch[2].trim() };
  }
  return { businessName: input };
}

function parseHandles(input: string): Array<{ platform: string; handle: string }> {
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim().replace(/^@/, ''))
    .filter(Boolean)
    .slice(0, 5)
    .map((handle) => ({ platform: 'instagram', handle }));
}
```

**Step 4: Run tests to see them pass**

Run: `npm test -- onboarding`
Expected: 5 tests passing.

**Step 5: Commit**

```bash
git add server/services/bot/onboarding.ts server/services/bot/onboarding.test.ts
git commit -m "feat(bot): onboarding state machine with TDD-tested transitions"
```

---

## Task 12: Bot user repository (TDD-light)

**Files:**
- Create: `server/services/bot/repo.ts`
- Create: `server/services/bot/repo.test.ts`

The repo wraps DB access. Tests hit a real test database — set `TEST_DATABASE_URL` in `.env.test` (or reuse `DATABASE_URL` if there's no separate test DB; warn the user before doing the latter).

**Step 1: Write failing tests**

`server/services/bot/repo.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { upsertBotUser, getOnboardingSession, saveOnboardingSession, completeOnboarding, getBusinessProfile } from './repo';
import { db } from '../../db';
import { botUsers, onboardingSessions, userBusinessProfile } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

const TEST_CHAT_ID = 'test-' + Date.now();

afterAll(async () => {
  // Cleanup any rows created by these tests.
  await db.delete(botUsers).where(eq(botUsers.telegramChatId, TEST_CHAT_ID));
});

describe('bot repo', () => {
  it('upserts a bot user (insert then update)', async () => {
    const u1 = await upsertBotUser({ telegramChatId: TEST_CHAT_ID, telegramUsername: 'first', name: 'First' });
    const u2 = await upsertBotUser({ telegramChatId: TEST_CHAT_ID, telegramUsername: 'second', name: 'Second' });
    expect(u1.id).toBe(u2.id);
    expect(u2.telegramUsername).toBe('second');
  });

  it('returns null for unknown onboarding session', async () => {
    const session = await getOnboardingSession(99999999);
    expect(session).toBeNull();
  });

  it('saves and reads back an onboarding session', async () => {
    const u = await upsertBotUser({ telegramChatId: TEST_CHAT_ID });
    await saveOnboardingSession({ userId: u.id, step: 'await_audience', pendingProfile: { niche: 'dental' } });
    const session = await getOnboardingSession(u.id);
    expect(session?.step).toBe('await_audience');
    expect(session?.pendingProfile?.niche).toBe('dental');
  });

  it('completing onboarding writes a business profile and clears the session', async () => {
    const u = await upsertBotUser({ telegramChatId: TEST_CHAT_ID });
    await saveOnboardingSession({
      userId: u.id,
      step: 'done',
      pendingProfile: { niche: 'dental', businessName: 'Test Clinic', audienceDescription: 'kids' },
    });
    await completeOnboarding(u.id);
    const profile = await getBusinessProfile(u.id);
    expect(profile?.niche).toBe('dental');
    expect(profile?.onboardingComplete).toBe(true);
    const session = await getOnboardingSession(u.id);
    expect(session).toBeNull();
  });
});
```

**Step 2: Run to see failure**

Run: `npm test -- repo`
Expected: FAIL — `Cannot find module './repo'`.

**Step 3: Implement**

`server/services/bot/repo.ts`:

```ts
import { db } from '../../db';
import { botUsers, onboardingSessions, userBusinessProfile, type BotUser, type NewBotUser } from '../../../shared/schema';
import { eq, sql } from 'drizzle-orm';

export async function upsertBotUser(values: NewBotUser): Promise<BotUser> {
  const [row] = await db
    .insert(botUsers)
    .values(values)
    .onConflictDoUpdate({
      target: botUsers.telegramChatId,
      set: {
        telegramUsername: values.telegramUsername ?? null,
        name: values.name ?? null,
        lastActiveAt: sql`NOW()`,
      },
    })
    .returning();
  return row;
}

export async function getOnboardingSession(userId: number) {
  const [row] = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function saveOnboardingSession(values: {
  userId: number;
  step: string;
  pendingProfile: Record<string, unknown>;
}) {
  await db
    .insert(onboardingSessions)
    .values({
      userId: values.userId,
      step: values.step,
      pendingProfile: values.pendingProfile as any,
    })
    .onConflictDoUpdate({
      target: onboardingSessions.userId,
      set: {
        step: values.step,
        pendingProfile: values.pendingProfile as any,
        updatedAt: sql`NOW()`,
      },
    });
}

export async function completeOnboarding(userId: number): Promise<void> {
  const session = await getOnboardingSession(userId);
  if (!session || session.step !== 'done') {
    throw new Error(`Cannot complete onboarding for user ${userId}; current step: ${session?.step}`);
  }
  const p = session.pendingProfile ?? {};
  await db
    .insert(userBusinessProfile)
    .values({
      userId,
      niche: (p as any).niche ?? 'other',
      businessName: (p as any).businessName ?? null,
      city: (p as any).city ?? null,
      country: (p as any).country ?? null,
      audienceDescription: (p as any).audienceDescription ?? null,
      inspirationHandles: (p as any).inspirationHandles ?? [],
      onboardingComplete: true,
    })
    .onConflictDoUpdate({
      target: userBusinessProfile.userId,
      set: {
        niche: (p as any).niche ?? 'other',
        businessName: (p as any).businessName ?? null,
        city: (p as any).city ?? null,
        country: (p as any).country ?? null,
        audienceDescription: (p as any).audienceDescription ?? null,
        inspirationHandles: (p as any).inspirationHandles ?? [],
        onboardingComplete: true,
        updatedAt: sql`NOW()`,
      },
    });
  await db.delete(onboardingSessions).where(eq(onboardingSessions.userId, userId));
}

export async function getBusinessProfile(userId: number) {
  const [row] = await db
    .select()
    .from(userBusinessProfile)
    .where(eq(userBusinessProfile.userId, userId))
    .limit(1);
  return row ?? null;
}
```

**Step 4: Run tests**

Run: `npm test -- repo`
Expected: 4 tests passing. **Important:** these tests touch the real DB. If `DATABASE_URL` is your dev DB, the cleanup in `afterAll` should remove the test rows. Verify with: `psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM bot_users WHERE telegram_chat_id LIKE 'test-%'"` → should be `0`.

**Step 5: Commit**

```bash
git add server/services/bot/repo.ts server/services/bot/repo.test.ts
git commit -m "feat(bot): bot user / profile / session repository with DB-backed tests"
```

---

## Task 13: Wire onboarding into the router

Replace the echo handler with real onboarding routing.

**Files:**
- Modify: `server/bot/router.ts`

**Step 1: Replace the file**

```ts
import type { Context } from 'grammy';
import { upsertBotUser, getOnboardingSession, saveOnboardingSession, completeOnboarding, getBusinessProfile } from '../services/bot/repo';
import { stepOnboarding, type OnboardingState } from '../services/bot/onboarding';
import { detectNiche } from '../services/bot/niche-detector';
import { callLlm } from '../services/bot/llm';

export async function handleUpdate(ctx: Context): Promise<void> {
  const chat = ctx.chat;
  const message = ctx.message;
  if (!chat || !message?.text) {
    return;
  }

  const user = await upsertBotUser({
    telegramChatId: String(chat.id),
    telegramUsername: ctx.from?.username ?? null,
    name: ctx.from?.first_name ?? null,
  });

  const profile = await getBusinessProfile(user.id);
  if (profile?.onboardingComplete) {
    await ctx.reply(
      `Welcome back, ${profile.businessName ?? 'friend'}. (Content workflow not built yet — coming in the next sub-plan.)`,
    );
    return;
  }

  const session = await getOnboardingSession(user.id);
  const state: OnboardingState = session
    ? { step: session.step as OnboardingState['step'], pendingProfile: (session.pendingProfile ?? {}) as OnboardingState['pendingProfile'] }
    : { step: 'new', pendingProfile: {} };

  const result = await stepOnboarding(state, message.text, {
    detectNiche: (msg) => detectNiche(msg, { llm: callLlm }),
  });

  await saveOnboardingSession({
    userId: user.id,
    step: result.nextState.step,
    pendingProfile: result.nextState.pendingProfile as Record<string, unknown>,
  });

  if (result.nextState.step === 'done') {
    await completeOnboarding(user.id);
  }

  await ctx.reply(result.reply);
}
```

**Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

**Step 3: Commit**

```bash
git add server/bot/router.ts
git commit -m "feat(bot): wire Telegram router to onboarding state machine"
```

---

## Task 14: Manual end-to-end smoke test — full onboarding

**Step 1: Start dev server (if not already running)**

Run: `npm run dev`
Expected: clean boot.

**Step 2: From a fresh Telegram account (or after clearing your test user from the DB), message the bot**

Send: `/start` (or just `hi`)
Expected: bot replies with the greeting and asks for business name.

Run through all 4 onboarding messages:
1. → bot asks for business
2. → reply with "Smile Tashkent dental clinic in Tashkent" → bot asks for audience
3. → reply with "cosmetic patients and families" → bot asks for inspirations
4. → reply with "@drsmiles, @perfect_dental_uz" → bot says onboarding done

**Step 3: Verify DB state**

Run:
```bash
psql "$DATABASE_URL" -c "SELECT bu.telegram_chat_id, bp.niche, bp.business_name, bp.city, bp.audience_description, bp.inspiration_handles, bp.onboarding_complete FROM bot_users bu JOIN user_business_profile bp ON bp.user_id = bu.id ORDER BY bu.created_at DESC LIMIT 1;"
```
Expected: a row with niche=`dental`, business_name=`Smile Tashkent dental clinic`, city=`Tashkent`, audience filled in, handles array populated, onboarding_complete=`true`.

**Step 4: Verify post-onboarding behavior**

Send another message to the bot.
Expected: "Welcome back, Smile Tashkent dental clinic. (Content workflow not built yet — coming in the next sub-plan.)"

**Step 5: If anything fails, debug and commit fixes**

Use commit message format: `fix(bot): <description of what broke>`.

---

## Task 15: Update CLAUDE.md with bot location notes

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Append a section**

At the end of `CLAUDE.md`, append:

```markdown

## BrandCoach Bot (new product line, in development)

A separate Telegram-bot-first product for non-tech small business owners. Lives in the same repo but doesn't share code paths with the LinkedIn-first web app.

**Code:**
- `server/bot/` — Telegram webhook entry, message router
- `server/services/bot/` — bot-specific services (intent, onboarding, niche detection, repo, LLM wrapper)
- `server/services/platforms/` — per-platform plugin adapters (Phase 1: Instagram only)

**Database:** New tables under names `bot_users`, `user_business_profile`, `onboarding_sessions`, etc. (see `shared/schema.ts`).

**Design doc:** `docs/plans/2026-04-22-personal-brand-bot-design.md`

**Phase 1 foundation plan:** `docs/plans/2026-04-22-brandcoach-bot-phase1a-foundation.md`

**Webhook URL:** `POST /api/bot/telegram/webhook` (set with `setWebhook` against the public ngrok/production URL).

**Required env vars:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (future), shared `GEMINI_API_KEY`, shared `DATABASE_URL`.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(bot): document BrandCoach bot location and webhook setup"
```

---

## Done — what's next

After Task 15, the foundation is in place: a real user can chat with the bot, complete onboarding, and have their profile persisted.

**Next sub-plan (write after this one ships):**
1. Instagram OAuth + posting adapter (`docs/plans/2026-XX-XX-brandcoach-bot-phase1b-instagram.md`)
2. Content engine + variant generation
3. Video pipeline (script → instructions → upload → caption → post)
4. Approval flow with inline keyboards
5. Nudge engine
6. Curated examples library + lightweight admin UI

**Verification checklist before declaring Phase 1a done:**
- [ ] All vitest suites pass: `npm test`
- [ ] Type check passes: `npm run check`
- [ ] Manual end-to-end onboarding flow works (Task 14)
- [ ] DB state matches expected schema after a fresh onboarding
- [ ] Existing ContentReworker web app still boots and is unchanged: `npm run dev` and visit `/`
- [ ] `CLAUDE.md` reflects the new bot location
