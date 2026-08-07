# NAVI-VICA — Visually-Intelligent Cognitive Assistant

A voice-first care companion for elderly and disabled users. One repository, two clients, one optional AI backend:

| Part | Folder | What it is |
|------|--------|------------|
| **Web app (PWA)** | [`web/`](web/) | The production app deployed on Vercel — works fully offline, on-device AI |
| **Mobile app** | [`frontend/`](frontend/) | Expo / React Native app (iOS, Android, web) |
| **AI backend** | [`backend/`](backend/) | FastAPI server: server-side YOLOv9 + Gemini scene analysis & chat |

## Web app (`web/`) — the primary version

Deployed at **https://navi-vica-v10.vercel.app**. Plain HTML/CSS/JS PWA, no build step.

Features:
- **Detect** — on-device YOLOv9 object detection (ONNX Runtime Web, model sizes 9–102 MB), profile-aware guidance (mobility / vision / cognitive / health)
- **Navigate** — Leaflet + OpenStreetMap walking routes, place search (Overpass), "take me home"
- **Voice** — wake-word ("VICA"), voice commands, live captions, AAC strip
- **Read** — camera OCR read-aloud (Tesseract.js)
- **Care** — medication alarms & appointments, symptom/vitals log, health card, doctor summary export
- **Safety** — SOS calls, location sharing, fall detection, scheduled check-ins, scam checker, panic button
- **Accounts** — local-first accounts with optional Supabase cloud sync (see [`web/SETUP.md`](web/SETUP.md)); everything works offline and syncs when signal returns
- **18 languages** (English & Russian complete, 16 voice-ready)

Configuration lives in [`web/config.js`](web/config.js):
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — optional cloud accounts & sync
- `SITE_URL` — used in password-reset links
- `BACKEND_URL` — optional: point at the FastAPI backend below and chat questions the on-device rules can't answer are answered by Gemini AI (graceful fallback when offline/unset)

## Backend (`backend/`)

FastAPI + MongoDB. Endpoints under `/api`:
- `POST /api/analyze-scene` — server-side YOLOv9 detection + Gemini scene description (accepts `confidence` threshold, `user_profile`)
- `POST /api/process-voice` — Gemini-powered chat/voice replies (replies in the user's language)
- `POST/GET/DELETE /api/reminders`, `PUT /api/reminders/{id}/toggle` — medication reminders
- `GET/PUT /api/settings` — user settings
- `GET /api/health` — health check

Run: `pip install -r backend/requirements.txt && uvicorn server:app --app-dir backend` (needs `MONGO_URL`, `EMERGENT_LLM_KEY` in `backend/.env`).

## Mobile app (`frontend/`)

Expo app with the same five core screens (home, camera scene analysis, voice chat, medication reminders, settings), talking to the backend via `EXPO_PUBLIC_BACKEND_URL`.

Run: `cd frontend && yarn && yarn start`.

## Deploying the web app to Vercel

The repo root has a `vercel.json` that serves `web/` as a static site — import the repo into Vercel and it deploys as-is, or run `vercel deploy` from the root.
