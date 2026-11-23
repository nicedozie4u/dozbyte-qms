# Dozbyte Queue Management Solution

On-site queue management for hospitals first, then banks. Each business gets a site server on its
own premises; kiosks print tickets, a waiting-room TV and counter signs call patients, and staff use
a browser console to call next and move patients from stage to stage. No cloud, no SMS, no internet
needed.

Planning documents: requirements, design and the development plan live in the project's docs.

## What is here (sprint 0)

| Path                  | What it is                                                                        |
| --------------------- | --------------------------------------------------------------------------------- |
| `packages/queue-core` | Pure queue rules: who is next, stage-to-stage moves, wait estimate, ticket states |
| `packages/shared`     | Zod schemas and types shared by server and screens; socket event names            |
| `packages/templates`  | Business type templates; `hospital.json` first                                    |
| `packages/config`     | Shared TypeScript settings                                                        |
| `apps/server`         | Site server: NestJS API, logins, queue engine, Socket.IO live updates             |
| `apps/web`            | Staff screens: login, front desk, staff console (Next.js)                         |
| `apps/kiosk-android`  | Kiosk app (Capacitor). Sprint 0: hardware spike checklist                         |
| `deploy/compose`      | Docker Compose for local Postgres and Redis                                       |
| `docs/adr`            | Decision records                                                                  |

Coming next: the waiting-room TV, counter signs and `apps/kiosk-web` in sprints 3 and 4, then
the admin portal. See the development plan for the full roadmap.

## Getting started

Needs Node.js 22, pnpm 10 and Docker.

```sh
corepack enable
pnpm install
pnpm db:up                                   # Postgres 16 and Redis 7
cp apps/server/.env.example apps/server/.env
pnpm --filter @dozbyte/server db:migrate     # apply migrations
pnpm build                                   # build shared packages and the server
pnpm --filter @dozbyte/server seed           # demo hospital; prints dev logins once
pnpm --filter @dozbyte/server start          # API on http://localhost:3001
pnpm --filter @dozbyte/web dev                # screens on http://localhost:3000
pnpm check                                   # format, lint, type check, tests
```

Server tests need a `dozbyte_test` database (`createdb -h localhost -U dozbyte dozbyte_test`);
set `TEST_DATABASE_URL` to use another one.

## Working on the code

Read [CONTRIBUTING.md](CONTRIBUTING.md) for conventions, branches and pull requests.
