# Contributing

The rules are few and enforced by tools, so review time goes on logic, not style.

## Code

- TypeScript `strict` everywhere. No `any` without a comment saying why.
- Prettier formats and ESLint checks; CI fails on either. Run `pnpm check` before pushing.
- Files and folders in kebab-case (`queue-engine.service.ts`), types and classes in PascalCase,
  functions and variables in camelCase, database tables and columns in snake_case.
- Every request body and socket message is checked with a Zod schema from `packages/shared`.
  The server never trusts a screen.
- Money in kobo as integers. Times in UTC in the database, Lagos time (WAT) on screen. Phone
  numbers in +234 format.
- User-facing words come from the template wording ("patient", "customer"), never hard-coded, so a
  new business type needs no code change (NFR-11).
- Socket event names follow `area.thing.action`, for example `queue.ticket.called`. Use the
  constants in `@dozbyte/shared`.
- Queue rules belong in `packages/queue-core` as pure functions with tests. Server modules load
  data, call queue-core and save the result.
- Each NestJS module owns its tables; other modules call its service, not its tables.

## Git and review

- Trunk-based: short branches off `main` named `feat/…`, `fix/…` or `chore/…`, merged within
  two days.
- Commit messages follow Conventional Commits: `feat(queue): move patient to next stage on Done`.
- Every pull request needs one approval, green CI, and the requirement IDs it serves (for example
  FR-8) in the description.
- `main` is always releasable. A tag such as `v0.3.0` builds the signed site update.
- Decisions that are hard to undo get a one-page ADR in `docs/adr/`.

## Database changes

Edit `apps/server/prisma/schema.prisma`, then run `pnpm --filter @dozbyte/server db:migrate` to
create a migration. Commit the schema and the migration together. CI fails if they drift apart.
Never edit a migration that has been merged.

## Secrets

The licence signing key and the update signing key never go in the repo or CI. They stay on one
offline laptop controlled by the Dozbyte team.
