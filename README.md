# LIAS

Local Intelligent Academic Scheduler (LIAS) turns an unstructured assignment or exam description into a reviewable milestone plan. All schedule data and inference stay on the local machine: FastAPI talks only to a local Ollama daemon, persists to SQLite, and serves a React calendar.

## What is included

- Structured Ollama inference validated with Pydantic
- A FastAPI API matching the SRS endpoints
- SQLite assignments and milestones with cascading deletes
- iCalendar export for Apple Calendar, Google Calendar, and compatible clients
- React + TypeScript UI with FullCalendar and fully local Whisper speech input
- Backend API tests that do not require Ollama

## Prerequisites

- Python 3.11+
- Node.js 20+
- [Ollama](https://ollama.com/) running locally

Pull a local model before starting LIAS:

```bash
ollama pull llama3.1:8b
```

The microphone uses `faster-whisper` locally instead of the browser's network-backed speech
service. Download its small English model once during setup:

```bash
cd backend
uv sync --all-extras
uv run python scripts/download_whisper_model.py
```

## Run locally

From the main project folder, the simplest first run is:

```bash
./scripts/setup.sh
./scripts/dev.sh
```

The setup script installs both dependency sets and downloads the small local speech model.
The development script starts FastAPI and Vite together; stop both with `Control-C`.

To run the services separately, start the backend in one terminal:

```bash
cd backend
uv sync --all-extras
cp .env.example .env
uv run uvicorn app.main:app --reload
```

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite development server proxies `/api` requests to `http://127.0.0.1:8000`.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/schedule/generate` | Generate and validate a proposed schedule without saving it |
| `POST` | `/api/transcribe` | Transcribe uploaded microphone audio with local Whisper |
| `POST` | `/api/schedule/commit` | Save an approved schedule to SQLite |
| `GET` | `/api/events` | Return FullCalendar-compatible deadline and milestone events |
| `GET` | `/api/schedule/export` | Download all saved events as an `.ics` file |
| `GET` | `/health` | Report API and local Ollama availability |

## Configuration

Backend settings use the `LIAS_` prefix. See [`backend/.env.example`](backend/.env.example) for available values.

The project requirements are preserved in [`docs/SRS.md`](docs/SRS.md).
