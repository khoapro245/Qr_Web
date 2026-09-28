# QR Care — notes for Claude

Shirts carry a unique QR code; a stranger who scans it sees the wearer's permitted public profile
(no login). Admins create customers (avatar, login, QR); customers log in with email or phone,
must change the temporary password, edit their profile and recover passwords by OTP.

## Working with the owner

- The owner speaks Vietnamese: **reply in Vietnamese**, write code, comments and commit messages in English.
- The owner is new to deployment and operations: explain in plain words, give exact commands to copy.
- **Do not run `git add`/`commit`/`push` yourself** (blocked in this environment). After each verified
  piece of work, give the owner the commands; commit messages end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ask before: architectural changes, changing the approved stack, adding a major dependency,
  significant new features, anything that costs money (domains, servers, paid services).
- Never claim something works without running it. Never commit secrets (`.env`, `deploy/production.env`).
- Priorities: security → correctness → privacy → maintainability → usability → visual quality.

## Status

- Milestones 1–12 of the original spec are done (auth, customers, avatars, QR, public page, OTP
  recovery, UI polish, security review, tests + CI, production packaging). CI on GitHub
  (`HaiDang193/Qr_Web`, private) has 3 jobs: quality, e2e, docker — all green.
- Not deployed to a real server yet. The owner has not bought a domain or VPS; the plan when they do
  is `docs/deployment.md` (Docker Compose + nginx + Let's Encrypt on an Ubuntu VPS in Vietnam).
- Customers are currently trying the app through a **Cloudflare quick tunnel from this computer**:
  `deploy/try-online.ps1` (start/restart, prints the new `https://*.trycloudflare.com` URL) and
  `-Stop`. The URL changes on every restart. It runs the production stack from `deploy/compose.yml`
  (project `qrcare-prod`, app on `127.0.0.1:4800`) with secrets in git-ignored `deploy/production.env`.
  Online admin: `admin@qrcare.local`; reset with
  `docker compose --env-file deploy/production.env -f deploy/compose.yml exec app node dist/scripts/seed-admin.js admin@qrcare.local --reset`.
- DBeaver access: dev DB `127.0.0.1:5432` (user `qrcare`, db `qrcare`, password in `backend/.env`);
  online DB `127.0.0.1:5433` through the helper container `qrcare-prod-db-access` (password =
  `POSTGRES_PASSWORD` in `deploy/production.env`). Remove with `docker rm -f qrcare-prod-db-access`.
- Open ideas, not started (ask first): fixed tunnel URL with a real domain, SMTP email for OTP,
  SMS provider, S3/R2 avatar storage, admin 2FA, privacy-policy page.

## Stack and layout

npm workspaces: `shared` (zod schemas, built to `shared/dist`), `backend` (Express 5, TypeScript,
Drizzle ORM, PostgreSQL 17), `frontend` (React 19, Vite, Tailwind 4, React Router, TanStack Query),
`e2e` (Playwright). TypeScript is pinned to ~6.0 (typescript-eslint limit); jsdom pinned to 29.

## Commands

```bash
docker compose up -d          # dev PostgreSQL (qrcare, qrcare_test, qrcare_e2e)
npm run dev                   # shared watch + API :4000 + web :5173
npm run lint && npm run typecheck && npm run format:check
npm test                      # backend (real DB qrcare_test) + frontend
npm run test:e2e              # Playwright on the production build (Edge locally)
npm run build
```

Run the full set (format, lint, typecheck, test, build, e2e) before reporting work as done.

## Docs

`docs/architecture.md` (decisions per milestone), `docs/api.md`, `docs/security-checklist.md`,
`docs/testing.md`, `docs/deployment.md`, `docs/operations.md`. Keep them updated with changes.
