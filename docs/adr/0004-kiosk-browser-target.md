# 0004: Kiosk browser target

Status: Proposed, 23 Nov 2026. Decided after the sprint 0 hardware spike.

## Context

The RK3288 kiosks run Android 7.1 or 9.0. Their built-in web view may be stuck at an old Chrome
version with no Google Play to update it. The kiosk page must run there smoothly.

## Decision (to confirm)

`apps/kiosk-web` is a small separate app, not part of the Next.js screens, built with a
conservative browser target that matches the web view version we measure on the real unit. It
avoids heavy client frameworks and new CSS features, and is tested on the unit every sprint.

## To record after the spike

- Chip, memory and Android version received:
- Android System WebView version:
- Printer SDK name and version:
- Capacitor version pinned:
- Browser target chosen:
