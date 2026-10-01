# NAVI-VICA Mobile

The native mobile app for NAVI-VICA — a voice-first care companion for elderly and disabled users. Expo / React Native, built from the October 2026 mockups: warm cream & terracotta, Fraunces headings, Atkinson Hyperlegible body text, big touch targets, and VICA speaking on every screen.

## Screens

**Core (same as the web app)**
- **Welcome** — what VICA does, create account / sign in, floating talk bar
- **Setup** — 4 steps: your name → real permission requests (mic, camera, location, bracelet, alerts, calls) → what to help with most → your people
- **Home** — greeting, big mic, live pulse & blood-pressure card, bracelet status, four helper tiles
- **Talking to VICA** & **Chat** — conversational brain that can open and drive every screen
- **Detect** — camera + spoken scene description (YOLOv9 + Gemini backend)
- **Navigate** — walking routes that never dead-end (Google Maps + Yandex fallbacks), share-my-location
- **Medicines** — daily alarms that ring on the lock screen with "I took it" / "remind me" actions
- **Emergency** — call 112, call your people, share location by SMS
- **My health** — live vitals, sparkline, manual readings, alert thresholds
- **Settings** — voice speed, text size, language, needs, people, bracelet, start over

**Phone-only**
- **Connect bracelet** — Bluetooth pulse band & BP cuff pairing (simulated until a dev build adds `react-native-ble-plx`)
- **Alarm** — full-screen dark medicine alarm: speaks, vibrates, huge clock
- **Pulse alert** — "Are you feeling okay?" with a 60-second countdown, then calls family
- **Fall detected** — accelerometer fall detection → red 30-second countdown → calls 112 and texts your location
- **Family view** — carer dashboard: vitals, medicines taken, safe zone, falls this week

## Run it

```bash
cd frontend
npm install
npx expo start
```

Scan the QR with Expo Go (voice recognition and real Bluetooth need a development build; everything else works in Go). To let VICA describe scenes, set `EXPO_PUBLIC_BACKEND_URL` to the FastAPI server in [`../backend`](../backend).

## Structure

- `theme.ts` — design tokens from the mockup
- `components/` — icons (stroke SVG set) and UI building blocks
- `lib/` — store (AsyncStorage), speech, alarms, health & bracelet, fall detection, backend bridge, conversational brain
- `app/` — one file per screen (expo-router)
