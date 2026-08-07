# NAVI-VICA Mobile

The native mobile companion app for NAVI-VICA — a voice-first care assistant for elderly and disabled users. Built with Expo / React Native for iOS and Android.

## Screens

- **Home** — dashboard with greeting, stats, and quick actions
- **Camera** — point the camera and hear what's around you (YOLOv9 + Gemini scene analysis via the backend)
- **Voice** — talk with VICA; voice commands open features hands-free
- **Meds** — medication reminders with alarms
- **Settings** — speech rate, language, profiles, notifications

## Run it

```bash
yarn install
EXPO_PUBLIC_BACKEND_URL=https://your-backend.example.com yarn start
```

Then scan the QR code with Expo Go, or press `a` / `i` for an emulator.

The camera and voice screens need the backend from [`../backend`](../backend) running (`uvicorn server:app`) with `GEMINI_API_KEY` configured.

> The full-featured production app is the web PWA in [`../web`](../web) — this Expo app is the native shell counterpart.
