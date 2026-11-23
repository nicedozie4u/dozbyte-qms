# 0001: One monorepo with pnpm and Turborepo

Status: Accepted, 23 Nov 2026

## Context

Everything that ships to a site (server, screens, kiosk app) changes together, and a team of two
to three developers cannot afford to coordinate releases across repos.

## Decision

One repository, `dozbyte-qms`, with pnpm workspaces and Turborepo. Apps live in `apps/`, shared
code in `packages/`. During early sprints, packages export their TypeScript source directly
(`"exports": "./src/index.ts"`) instead of building to `dist/`; apps compile them. We add a build
step to a package only when something outside the monorepo needs it.

## Consequences

One pull request can change the server, the screens and the shared types together, and CI checks
them as one. The repo grows, so Turborepo caching keeps CI fast.
