# 0002: Prisma for database access and migrations

Status: Accepted, 23 Nov 2026

## Context

The design doc chose PostgreSQL on each site server. Hundreds of site servers must upgrade their
database safely and the same way, from a signed update file, with no developer present.

## Decision

Prisma (version 7, pinned) defines the schema in `apps/server/prisma/schema.prisma`. Every change
is a checked-in SQL migration, and the site update runs `prisma migrate deploy`. Database names
are snake_case through `@map`; TypeScript names are camelCase. Every table has `tenant_id`.

## Consequences

Migrations are plain SQL we can read and test on the office lab before they reach a site. Complex
reporting queries may need raw SQL, which Prisma allows. CI fails if the schema and migrations
drift apart.
