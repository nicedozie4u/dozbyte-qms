# Kiosk app (Android)

A thin Capacitor shell for the RK3288 touch kiosk (Android 7.1 or 9.0). It shows the kiosk page
from the site server full-screen and passes print jobs to the built-in thermal printer through the
supplier's printer SDK (FR-26). Code lands after the hardware spike below.

## Sprint 0 hardware spike

Do this on one real unit before buying more. Record every answer in `docs/adr/0004`.

- [ ] Confirm the chip, memory (2 GB or more) and Android version on the unit received
- [ ] Get the supplier's printer SDK and its documentation
- [ ] Record the Android System WebView version (Settings, Apps, Android System WebView)
- [ ] Build a Capacitor app that loads a page from a laptop on the same network
- [ ] Print a test 80 mm ticket silently, with no dialog, through the SDK
- [ ] Print a QR code and check a phone can scan it
- [ ] Check the app starts on power-up and can hide the home and back buttons
- [ ] Pull the power, restore it, and check the app comes back to the kiosk page by itself

The web view version decides the browser target for `apps/kiosk-web` and which Capacitor version
we pin.
