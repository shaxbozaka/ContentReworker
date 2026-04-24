# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Content Reworker is a **LinkedIn-first** AI content repurposing tool that transforms blog posts and articles into viral LinkedIn posts with optimized hooks. Other platforms (Twitter, Threads, Instagram, Email) are available as secondary options.

**Live URL**: https://aicontentrepurposer.com

## Product Mission

**Core Value Proposition**: Turn any blog post into a viral LinkedIn post in 60 seconds with 3 hook variations and 1-click posting.

**Target User**: Content creators, marketers, and professionals who want to maximize their LinkedIn presence without spending hours rewriting content.

**Differentiation**:
- LinkedIn Hook Optimizer (3 viral hook styles per post)
- 1-click direct posting to LinkedIn
- Analytics to learn which hook styles perform best

**Pricing**:
- Free tier: Limited generations
- Pro: $19/month or $15/month billed annually ($180/year, 20% discount)

## Development Commands

```bash
npm run dev          # Start development server (tsx server/index.ts)
npm run build        # Build for production (Vite frontend + esbuild backend)
npm run start        # Run production build
npm run check        # TypeScript type checking
npm run db:push      # Push Drizzle schema to database
```

## Docker Deployment

```bash
docker compose up -d              # Start app + PostgreSQL containers
docker compose build app          # Rebuild app container
docker compose up -d --force-recreate app  # Deploy changes
docker compose logs app --tail 50 # View logs
```

The app runs on port 5000, PostgreSQL on port 5433.

## Screenshot Tool

```bash
node screenshot.cjs [url] [output]
node screenshot.cjs https://aicontentrepurposer.com /tmp/screenshot.png
```

## Architecture

### Stack
- **Frontend**: React 18 + Vite + wouter (routing) + TanStack Query + shadcn/ui + Tailwind CSS
- **Backend**: Express.js with TypeScript (ESM)
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Google Gemini (gemini-2.0-flash) as primary provider - fast, cheap, quality. OpenAI and Anthropic available as fallbacks.
- **Auth**: Google OAuth + LinkedIn OAuth + username/password
- **Payments**: Stripe (subscriptions via Checkout Sessions + webhooks)

### Directory Structure
- `client/` - React frontend
  - `src/components/` - UI components (shadcn/ui in `ui/`, app components at root)
    - `ProPaywall.tsx` - Reusable premium feature paywall component
    - `DemoSection.tsx` - Animated demo with human-like cursor movement
  - `src/pages/` - Route pages (home, accounts, pricing, schedule, generate, carousel, etc.)
  - `src/context/ContentContext.tsx` - Global content state management
  - `src/context/AuthContext.tsx` - Global authentication state (Google OAuth, login/logout)
- `server/` - Express backend
  - `routes.ts` - All API endpoints
  - `storage.ts` - Database operations
  - `services/` - External service integrations:
    - `openai.ts`, `gemini.ts`, `anthropic.ts` - AI providers
    - `linkedin.ts` - LinkedIn OAuth and posting
    - `google-auth.ts` - Google OAuth
    - `scheduler.ts` - Background job scheduler for scheduled posts
    - `pdf-carousel.ts` - PDF carousel generation
    - `image-generation.ts` - AI image generation
- `shared/schema.ts` - Drizzle tables + Zod validation schemas (shared between client/server)

### Key API Endpoints

**Content Transformation**
- `POST /api/repurpose` - Transform content for multiple platforms
- `POST /api/repurpose/regenerate` - Regenerate content for single platform

**Authentication**
- `GET /api/auth/google` - Get Google OAuth URL
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/me` - Get current logged-in user
- `GET /api/auth/linkedin/login` - LinkedIn OAuth for login
- `GET /api/auth/linkedin/callback` - LinkedIn OAuth callback (handles both login and connect flows via state prefix)
- `POST /api/users/register`, `POST /api/users/login` - User authentication

**Social Posting**
- `POST /api/social/linkedin/post` - Post content to LinkedIn

**Billing (Stripe)**
- `POST /api/billing/checkout` - Create Stripe Checkout session
- `POST /api/billing/webhook` - Stripe webhook endpoint (signature verification)
- `GET /api/billing/status` - Get user subscription status
- `POST /api/billing/portal` - Get Stripe billing portal URL

**Scheduled Posts (Pro Feature)**
- `GET /api/scheduled-posts` - Get user's scheduled posts
- `POST /api/scheduled-posts` - Create scheduled post
- `DELETE /api/scheduled-posts/:id` - Delete scheduled post

**Pro Features**
- `POST /api/carousel/generate` - Generate PDF carousel
- `POST /api/images/generate` - AI image generation

**Analytics**
- `POST /api/analytics/hook-selection` - Track hook selection, copy, and post events

### Database Schema (shared/schema.ts)

**Users Table**
- `id`, `username`, `password`, `email`, `googleId`, `linkedinId`, `name`, `avatarUrl`
- Subscription fields: `plan` ('free' | 'pro'), `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `subscriptionEndDate`
- `createdAt`

**Other Tables**
- `transformations` - Content transformation records
- `transformationOutputs` - Generated content per platform
- `socialConnections` - OAuth tokens for social platforms (LinkedIn)
- `scheduledPosts` - Scheduled posts for future publishing (userId, content, platform, scheduledAt, status)
- `hookAnalytics` - Tracks which hooks users select, copy, and post (hookType, hookIndex, platform, wasCopied, wasPosted)

## Stripe Integration

### Setup
Webhooks are created programmatically via API. To recreate:
```javascript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
await stripe.webhookEndpoints.create({
  url: 'https://aicontentrepurposer.com/api/billing/webhook',
  enabled_events: [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
  ],
});
```

### Important Notes
- Test mode and Live mode have separate webhooks and secrets
- Webhook endpoint skips JSON body parsing (needs raw body for signature verification)
- Customer is created before checkout session for better tracking
- Metadata includes userId on both session and subscription

## Custom Agents

Located in `.Codex/agents/`:

- **ceo** - Business strategy, market positioning, monetization, growth, competitive analysis. Thinks like a startup founder - focused on outcomes, not code.
- **cto** - Technical architecture, security audits, code quality, performance, infrastructure, technical debt. Owns all engineering decisions with specific file/line-level detail.
- **designer** - UI/UX design reviews, visual design feedback, accessibility audits, design system decisions, component design, layout critiques.

## Environment Variables

Required in `.env` or `.env.production`:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# AI Providers
GEMINI_API_KEY=xxx          # Primary AI provider
OPENAI_API_KEY=xxx          # Optional fallback
ANTHROPIC_API_KEY=xxx       # Optional fallback

# Session
SESSION_SECRET=xxx

# Google OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://aicontentrepurposer.com/api/auth/google/callback
BASE_URL=https://aicontentrepurposer.com

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=xxx
LINKEDIN_CLIENT_SECRET=xxx
LINKEDIN_REDIRECT_URI=https://aicontentrepurposer.com/api/auth/linkedin/callback

# Stripe (Billing)
STRIPE_SECRET_KEY=xxx              # sk_test_xxx or sk_live_xxx
STRIPE_WEBHOOK_SECRET=xxx          # whsec_xxx (from webhook creation)
```

## Key Features

### Core (Free)
- **Content Transformation**: Paste blog post → get LinkedIn post with 3 hook variations
- **LinkedIn Hook Optimizer**: 3 viral hook styles (curiosity gap, bold statement, story-based)
- **One-Click LinkedIn Posting**: Connect account and post directly
- **Platform Flexibility**: LinkedIn (primary), Twitter, Threads, Instagram, Email
- **Google/LinkedIn Sign In**: OAuth authentication

### Pro ($19/month or $15/month annual)
- **Scheduled Posts**: Schedule LinkedIn posts for future publishing
- **PDF Carousel Generator**: Create downloadable carousel PDFs
- **AI Image Generation**: Generate images for posts
- **Priority Support**

### Analytics (Internal)
- **Hook Selection Tracking**: Which hooks users select, copy, and post
- **Performance Data**: Content length, platform, conversion to post

## Recent Changes

### LinkedIn-First Strategy (Jan 2026)
- Simplified platform selection: LinkedIn prominently featured, others collapsed under "More platforms"
- Removed podcast/YouTube transcript references - focused on blog posts
- Dynamic "Create [Platform] Post" button based on selection

### Pricing Update (Jan 2026)
- Standardized pricing: $19/month or $15/month annually ($180/year)
- Added annual/monthly toggle on pricing page with 20% discount messaging
- Clear value comparison between Free and Pro tiers

### Hook Analytics (Jan 2026)
- New `hookAnalytics` database table
- Tracks: hook selection, copy events, successful posts
- Data: hookType, hookIndex, platform, contentLength, wasCopied, wasPosted
- Frontend tracking in `PlatformOutput.tsx` and `LinkedInPostModal.tsx`

### UI Improvements (Jan 2026)
- Fixed cursor animation in `DemoSection.tsx` using ref-based position tracking
- Fixed hook generation stripping leading numbers (regex: `\d+[.\)]\s*` not `\d+\.?\s*`)
- Dark mode for Advanced Settings (`AiSettings.tsx`)
- `ProPaywall.tsx` - Premium dark-themed paywall component with glow effects
- Human-like cursor animation using bezier curves and natural easing

### Stripe Billing Integration
- Checkout Sessions with customer creation
- Webhook handling for subscription lifecycle events
- Raw body parsing fix for webhook signature verification
- Billing portal for subscription management

### Scheduled Posts
- Background scheduler service (`server/services/scheduler.ts`)
- Database table for storing scheduled posts
- UI at `/schedule` with Pro paywall

### LinkedIn OAuth Fix
- Consolidated callback handling with state-based flow differentiation
- Login flow uses `login_` state prefix
- Connect flow for linking existing accounts

## Roadmap / Next Steps

1. **Measure hook performance** - Analyze which hook styles get selected/copied/posted most
2. **A/B test hooks** - Use analytics to improve hook generation prompts
3. **Social proof** - Add real user testimonials and metrics
4. **Content library** - Let users save and organize generated content
5. **Team features** - Collaboration for agencies/teams (future Pro+ tier)
