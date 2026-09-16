# AI Calendar

AI Calendar helps students turn an assignment or exam description into a reviewable milestone
plan. Guests keep approved events in browser storage; signed-in users sync events through Cloud
Firestore. A FastAPI backend generates structured plans with the Gemini API.

## What is included

- A responsive React + TypeScript login and calendar experience
- Google sign-in and guest entry through Firebase Authentication
- Manual events and deadlines on the calendar
- Per-user realtime calendar storage in Cloud Firestore
- Owner-only Firestore Security Rules
- Gemini structured output validated with Pydantic
- Firebase ID-token verification on protected FastAPI routes
- Local Whisper speech transcription
- iCalendar and SQLite compatibility endpoints retained during the cloud migration

## Prerequisites

- Python 3.11+
- Node.js 20+
- A Firebase project with Google and Anonymous Authentication and Firestore enabled
- A Gemini API key when schedule generation is ready to be tested

## Configure Firebase

The repository is connected to Firebase project `lias-abff9` in `.firebaserc`.

1. In Firebase Console, create the Firestore database if it does not exist.
2. Under Authentication → Sign-in method, enable Google. The repository's `firebase.json`
   enables Anonymous when you deploy the Auth configuration.
3. Add local and production hosts to Authentication → Authorized domains.
4. Copy `.env.example` to `.env` and provide the Firebase web API key.
5. Install Firebase CLI if needed, sign in, and deploy the rules:

```bash
firebase deploy --only auth,firestore
```

The Firebase web key is project metadata, not a server secret. The Gemini key must never use a
`VITE_` variable or appear in frontend code.

## Configure Gemini

Copy `backend/.env.example` to `backend/.env`, then set:

```dotenv
LIAS_GEMINI_API_KEY=your-server-side-key
```

The default model is configurable through `LIAS_GEMINI_MODEL`. With no key, the backend starts
normally and `/health` reports `inference: not_configured`; generation returns an actionable 503.

## Run locally

From the project root:

```bash
./scripts/setup.sh
./scripts/dev.sh
```

Or run the services separately:

```bash
cd backend
uv sync --all-extras
uv run uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://127.0.0.1:8000`.

## Data model

Each account owns its data under these Firestore paths:

```text
users/{uid}
users/{uid}/assignments/{assignmentId}
users/{uid}/events/{eventId}
```

The React app subscribes to a signed-in user's events. An approved proposal is committed as one
Firestore batch containing the assignment, milestone events, and final deadline. Anonymous guest
events are written to `localStorage` under `ai-calendar-guest-events-v1` and never written to
Firestore. Manual events are saved alongside generated milestones. Anonymous authentication still
gives guests an ID token for the protected AI API; plan prompts are sent to the backend for
generation.

## Verification

```bash
cd frontend && npm run build
cd backend && uv run ruff check . && uv run pytest -q
```
