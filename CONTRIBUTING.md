# Contributing

Thanks for thinking about contributing. Quick read so you can spend more time on actual work.

## Workflow

1. Open an **issue** before a non-trivial PR. Saves you from rebasing onto a feature we already shipped on a branch you didn't see.
2. Branch from `main`. Keep your branch up to date — we keep history mostly linear (squash-merge or rebase-merge).
3. PR title format: `<area>: <imperative summary>`, e.g. `recommender: cap diversity at 3 per creator` or `security: rate-limit /api/auth/forgot-password`.
4. Run the gates locally before pushing:
   ```bash
   npm run check    # tsc, no warnings
   npm test         # vitest, all passing
   ```
5. Don't add `Co-Authored-By:` trailers from AI tools. Author your commit yourself.

## What's a good PR

- **Bug fix** — include the failing test that proves it, plus the fix
- **New feature** — issue first, then PR; we'll discuss the schema/UI implications before you build
- **Docs / typos** — just send the PR
- **New AI provider** — add to `server/services/<provider>.ts` matching the existing shape (OpenAI / Anthropic / Gemini). Wire it into the fallback chain in `server/routes.ts:getProviderFallbackOrder`.
- **New social integration / scraper** — open an issue. Almost always involves a schema change and OAuth scope discussion.
- **New ranking signal** — touch `server/services/trending.ts:getCuratedVirals` and explain the weight you're picking in the PR description.

## What we won't merge

- Code that disables typecheck or test gates "for now"
- Hardcoded secrets in any file (use `.env.example` to document new env vars instead)
- New dependencies that haven't been audited (`npm audit` after adding) or that have <100k weekly downloads on npm
- Changes that fail the security audit checklist in `SECURITY.md`

## Getting set up

See the [Quick start](./README.md#quick-start-local) section in the README. Everything you need is in `.env.example`.

## Codebase orientation

- `client/` — Vite + React 18 + Tailwind + shadcn/ui. Routing via `wouter`. Data fetching via TanStack Query.
- `server/` — Express + TypeScript via tsx. Routes in `server/routes.ts`, services in `server/services/`, DB access via Drizzle in `server/db.ts`.
- `shared/schema.ts` — single source of truth for the data model. Drizzle table defs + Zod schemas. Run `npm run db:push` after edits.
- `client/src/pages/` — top-level routes. `home.tsx` is the repurposer, `trending.tsx` is the ideas feed, `creators.tsx` is the tracked-accounts manager.

## Questions

Open an issue with `[question]` in the title. We try to answer within a few days.
