# VELORA — massage studio

[![CI](https://github.com/samkata656/VELORA-massage-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/samkata656/VELORA-massage-studio/actions/workflows/ci.yml)

Booking site and admin panel for VELORA, a 3-room, 5-therapist massage studio in Sofia.

- **Public site** in Bulgarian (`/bg`, default) and English (`/en`), with prices in EUR:
  - treatments and prices, benefits articles, online booking
  - guest checkout, or an account with booking history and a preferred therapist
  - self-service cancel or reschedule up to 24h before the booking
- **Admin** (`/admin`, English):
  - dashboard with today's bookings and weekly shifts and revenue per therapist
  - day schedule by therapist and by room, showing buffers and lunch
  - work rota with an AI chat assistant (via n8n) and rule-checked manual edits
  - appointments (create, cancel, delete, reassign), therapists, procedures and prices
- **n8n integration**: REST API for the AI booking chat, signed outbound events and the rota assistant. See [docs/n8n-webhooks.md](docs/n8n-webhooks.md).

## Stack

Node.js 26 · Next.js 16 (App Router, Server Actions) · React 19 · Tailwind CSS 4 · PostgreSQL 18 · Prisma 7 (pg driver adapter) · Zod · Vitest.

## Run it

### Everything in Docker

```bash
cp .env.example .env        # then fill in the secrets (see below)
docker compose --profile app up -d --build
docker compose logs migrate # shows the generated admin password on the first run
```

- This starts Postgres, a one-shot `migrate` service (`prisma migrate deploy` plus seed) and the app on <http://localhost:3000>.
- Set `APP_PORT=3002` to use a different host port.
- The seed only runs on an empty database.
- Postgres is published on `127.0.0.1:5433` only. On a server, set `POSTGRES_PASSWORD` (letters and digits only, e.g. `openssl rand -hex 32`) before the first start and use the same password in `DATABASE_URL`.

**Secrets in `.env`.** Generate each with `openssl rand -base64 36`:

| Variable | Without it |
|---|---|
| `N8N_API_KEY` (min. 32 characters) | The `/api/n8n/*` API answers `503 not_configured`. |
| `N8N_WEBHOOK_SECRET` | No outbound events are sent, because unsigned events could be forged. |
| `SEED_ADMIN_PASSWORD`, `SEED_DEMO_PASSWORD` | The seed generates random passwords and prints them once. |

### On a VPS with Portainer

[`docker-compose.portainer.yml`](docker-compose.portainer.yml) runs ready-made images, so nothing is built on the server. When CI passes on `main`, the **Publish Docker images** workflow pushes two images:
- `ghcr.io/samkata656/velora-massage-studio`: the app
- `ghcr.io/samkata656/velora-massage-studio-migrate`: a one-off job that applies migrations and seeds an empty database

Each image gets the tags `latest` and `sha-<commit>`.

1. **Let the VPS pull the images.** New GHCR packages are private. Either:
   - make both public (GitHub → your profile → Packages → package → Package settings → Change visibility), or
   - in Portainer, add the `ghcr.io` registry with a GitHub token that has `read:packages`.
2. **Create the stack:** Portainer → Stacks → Add stack, then either:
   - paste the file into the **Web editor**, or
   - choose **Repository** with this repo's URL and compose path `docker-compose.portainer.yml`.
3. **Add the environment variables.** `POSTGRES_PASSWORD` and `APP_URL` are required. The rest are explained at the top of the file.
   - Generate the database password with `openssl rand -hex 32`. It goes into the connection URL, so base64 characters like `/`, `+` and `=` would break it.
   - Generate the other secrets with `openssl rand -base64 36`.
4. **Deploy.** On the first deploy, open the `velora-migrate-1` container logs for the generated admin password. Set `SEED_ADMIN_PASSWORD` beforehand if you'd rather choose it.
5. **Update:** use **Update the stack** with **Re-pull image**. Migrations run again automatically and existing data is kept. Set `VELORA_TAG=sha-xxxxxxx` to pin or roll back a version.

**Networking.** The app listens on port `3000` (`APP_PORT`), and the database is never published. Put HTTPS in front with a reverse proxy, Cloudflare or a Cloudflare Tunnel. If the proxy runs on the same host, set `APP_BIND=127.0.0.1` so port 3000 isn't open to the internet. Behind Cloudflare, the app reads the visitor IP from `CF-Connecting-IP`, which the login limiter and Turnstile rely on.

**Back up the database:**

```bash
docker exec velora-db-1 pg_dump -U velora velora > velora-$(date +%F).sql
```

The images are built for `linux/amd64`, which covers most VPS plans.

### Local development (database in Docker)

```bash
docker compose up -d db     # Postgres on localhost:5433
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Other scripts: `npm test` (unit tests), `npm run typecheck`, `npm run lint`, `npm run db:studio`.

**CI** (`.github/workflows/ci.yml`) runs on every push to `main` and on every pull request, as four parallel jobs:
- lint, type check, unit tests and a production dependency audit
- migrations and seed (run twice) against PostgreSQL 18, plus a check that the schema matches the migrations
- production build with a smoke test of pages and the n8n API
- Docker image build

Dependabot opens weekly update PRs for npm packages, the pinned GitHub Actions and the Docker base image.

### Seeded accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@velora-spa.bg` (`SEED_ADMIN_EMAIL`) | `SEED_ADMIN_PASSWORD`, or a random one printed by the seed |
| Demo client | `demo@velora-spa.bg` (`SEED_DEMO_EMAIL`) | `SEED_DEMO_PASSWORD`, or a random one printed by the seed |

Set these in `.env` **before** the first seed. There are no default passwords.

**Login protection.** After 10 failed logins for one email, or 30 from one IP address, login is blocked for 15 minutes.

**Bot protection (Cloudflare Turnstile).** Login, registration and booking show a Turnstile check, and the server verifies every token with Cloudflare.
- **To turn it on:** create a widget in the Cloudflare dashboard (Turnstile → Add widget, with your domain), then set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in `.env`. The keys are read at runtime, so no rebuild is needed.
- **While the secret is empty, protection is off**, so local setups work without Cloudflare.
- **Testing:** Cloudflare's public test keys (in `.env.example`) always pass and show a "For testing only" note.
- **Each token is tied to its form and used once.** If Cloudflare can't be reached, the request is refused.
- **Not covered:** the n8n API (protected by its key) and the admin panel (behind admin login).

**Guest bookings stay guest bookings.** Registering doesn't attach earlier guest bookings with the same email, because emails are not verified. Guests manage a booking through the private link in their confirmation.

## Studio rules (enforced on the server)

| Rule | How it is applied |
|---|---|
| Shifts 10:00–19:00, open 7 days | A procedure must finish by 19:00. Booking grid is 15 min, up to 60 days ahead, at least 60 min in advance. |
| 20 min after every procedure | The therapist **and** the room stay blocked for 20 min after each procedure. |
| 30-min lunch between 12:00 and 14:00 | Flexible: a booking is only accepted if a free 30-min gap is still left in that window. The schedule shows where lunch falls. |
| 3 rooms, couples massage | Couples needs 2 therapists and 2 rooms at the same start. |
| No double booking | PostgreSQL `EXCLUDE` constraints on therapist and room time ranges. Parallel requests for one slot get exactly one success. |
| Preferred therapist | Account holders only. Guests get the least busy free therapist. |
| Cancel or reschedule | Clients can do it up to 24h before. Admins can do it at any time. |
| Max 5 days in a row | Checked across week boundaries. |
| 2 consecutive days off per 7 days | Read as: every calendar **Mon–Sun week** has 2 consecutive days off. |

**The rota** is generated 8 weeks ahead:
- Target is 3 therapists per day (one per room), minimum 2.
- Shifts are shared fairly and stay close to the published rota.
- Admins change it through the AI chat or the manual form (absences, extra shifts, day off, add a shift). Both show a preview before saving.
- They can also click days in the grid. Every edit is checked against the rules above.
- Bookings whose therapist becomes absent are listed on the dashboard with **Auto-reassign**.

**Weekly stats.** "Shifts worked" counts shifts up to today. "Expected revenue" is the sum of booked and completed appointments for the week. A couples massage is split between its two therapists.

## Project layout

```
prisma/                 schema, migrations (incl. exclusion constraints), seed
src/lib/scheduling/     pure engine: availability/slots, rota generator, rule checks (+ tests)
src/lib/services/       booking, rota, stats, scheduler chat, catalog
src/lib/webhooks/       transactional outbox + signed delivery
src/app/[locale]/       public site (bg/en)
src/app/admin/          admin panel
src/app/api/n8n/        API for n8n
docs/n8n-webhooks.md    integration reference
```

## Contact details used on the site (fictional)

+359 88 712 4560 · hello@velora-spa.bg · 14 Oborishte St, Sofia 1504
