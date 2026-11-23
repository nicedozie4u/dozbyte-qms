# 0003: Socket event names and rooms

Status: Accepted, 23 Nov 2026

## Context

The staff console, waiting-room TV, counter signs and phone page all listen for live queue changes
over Socket.IO (NFR-1: within 2 seconds). Free-form event names drift apart between server and
screens.

## Decision

Event names follow `area.thing.action` (for example `queue.ticket.called`) and are defined once as
constants in `@dozbyte/shared`. Payloads are Zod schemas in the same package. Screens join rooms:
`branch:<id>` (TV, dashboard), `counter:<id>` (staff console, counter sign) and `ticket:<id>`
(phone page).

## Consequences

A renamed event fails the type check instead of failing silently at a site. A screen receives
only what its room needs, which keeps the old kiosk and TV browsers light.
