# AI Calendar

AI Calendar helps students turn an assignment or exam description into a reviewable milestone
plan. Guests keep approved events in browser storage; signed-in users sync events through Cloud
Firestore. A FastAPI backend generates structured plans with the Gemini API and serves private
iCalendar subscription feeds for signed-in users.

## What is included

- A responsive React + TypeScript login and calendar experience
- Google sign-in through Firebase Authentication
- Guest entry through Firebase anonymous authentication, with events stored in this browser
- Manual events and deadlines on the calendar
- Clickable event details with dates, times, and task instructions
- Per-user realtime calendar storage in Cloud Firestore
- A separate, read-only iCalendar subscription for Apple Calendar, Google Calendar, and compatible apps
- One-time `.ics` export for guest calendars
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
5. Give the FastAPI server Firebase Admin credentials with access to the same project.
   Locally, set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON path; on a managed
   Google Cloud runtime, use its service identity.
6. Install Firebase CLI if needed, sign in, and deploy the rules:

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
gives guests an ID token for the protected AI API.
Plan prompts are sent to the backend and Gemini for generation; guest calendar events are the data
kept only in the browser.

## Add to Calendar

For signed-in users, **Add to Calendar** creates a private, read-only `.ics` feed. Apple Calendar
can open its `webcal:` link. In Google Calendar on the web, use **Other calendars → From URL** and
paste the subscription URL. This appears as a separate calendar that can be shown or hidden. New
events appear when the calendar app refreshes the subscription. The API must be reachable over
public HTTPS for remote calendar apps to refresh it. Set `LIAS_PUBLIC_API_ORIGIN` to that public
backend origin in production; a `localhost` development URL only works on the same machine.
Anyone with the URL can read its events, so keep the link private. **Reset private link** revokes
the old subscription URL.

Guest events stay in the browser and cannot serve a live feed. Guests can download a `.ics`
snapshot and import it into a new calendar. Export again after making changes in guest mode.

## Verification

```bash
cd frontend && npm run build
cd backend && uv run ruff check . && uv run pytest -q
```
