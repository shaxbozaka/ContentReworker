# Security policy

## Reporting a vulnerability

If you've found something that looks like a real security bug — anything that
could let one user read or modify another user's data, bypass billing, leak
secrets, escalate privileges, or burn through API quota — please report it
**privately**. Don't open a public issue.

**Preferred channel:** [GitHub Security Advisories](https://github.com/shaxbozaka/ContentReworker/security/advisories/new)
(creates a private thread with the maintainer and lets us coordinate a fix
before public disclosure).

**Email fallback:** `hello@aicontentrepurposer.com` — please include "[security]"
in the subject. PGP not currently supported; if you need encrypted comms,
flag that in the email and we'll set up a Signal thread.

## What to include in a report

A high-quality report makes the difference between a same-day fix and weeks
of back-and-forth. Please include:

1. **A short summary** of the issue in one or two sentences
2. **Affected endpoint / file / commit** (with line numbers if you can)
3. **A minimal proof-of-concept** — `curl` command, request body, or a small
   script that reproduces the issue on a current build
4. **Impact** — what an attacker could actually do
5. **A suggested fix** if you have one in mind (optional but appreciated)

## What we'll do

- Acknowledge your report within **3 business days**
- Confirm reproduction (or push back with what we couldn't reproduce) within **7 days**
- Ship a fix or a mitigation within **30 days** for High / Critical severity issues; lower-severity issues on a best-effort timeline
- Credit you in the advisory (or keep your handle out of it, your call)

## Scope

In-scope:
- The web app at `aicontentrepurposer.com` and any subdomain serving it
- The code in this repo
- The companion browser extension (when it ships)

Out of scope:
- Vulnerabilities in third-party services we use (LinkedIn API, Paddle, Google OAuth, etc.) — please report those to the respective vendors
- DDoS, brute-force without a finding, social engineering, physical security
- Any test that requires you to access another user's account or data without their consent — please use only your own test accounts

## Safe harbour

We won't pursue legal action against good-faith security research that
follows the scope above. Don't intentionally degrade service for other users,
don't access data belonging to anyone else, and we're square.

## Past advisories

None publicly disclosed yet. The first batch of pre-public-flip findings
(C1–C4, H1–H7, M1–M3, L1–L7) was self-discovered and patched before the
repo became public — visible in the `security:` commits in `git log`.
