# Software Requirements Specification (SRS)

## Project Title: Local Intelligent Academic Scheduler (LIAS)

**Version:** 1.0.0
**Date:** September 10, 2026
**Target Audience:** Software Engineering Team / Core Developers

## 1. Introduction

### 1.1 Purpose

LIAS is a private, zero-cost, locally hosted productivity pipeline designed for students. It translates unformatted voice or text inputs concerning academic deliverables into milestone-driven calendar intervals using a local large language model and a dynamic UI visualization layer.

### 1.2 Scope

The system is a standalone Python pipeline running locally on consumer hardware. It combines local input capture, validated local inference, SQLite persistence, a FastAPI middle tier, and a modern React calendar.

## 2. System topology

```text
React + FullCalendar + Web Speech API
                  |
              HTTP / JSON
                  |
FastAPI ---- SQLite ---- Ollama client
                              |
                     127.0.0.1:11434
                              |
                    Local Ollama daemon
```

## 3. Component requirements

### 3.1 Input and ingestion

- Accept raw text and live microphone input.
- Prefer the browser-native `SpeechRecognition` interface for a zero-dependency client path.
- Deliver transcribed input to the orchestrator as clean UTF-8 text.

### 3.2 Core inference engine

The local Ollama orchestrator must infer an absolute deadline and proactive milestones from arbitrary input.

- Essays: brainstorm/thesis, outline, initial draft, peer or writing-center review, and polish.
- Exams: concept compilation, active recall or flashcards, spaced review, and a timed mock exam.
- Pass a strict JSON Schema through Ollama structured output and validate the response before it reaches the rest of the system.

### 3.3 Relational persistence

```sql
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  raw_prompt TEXT,
  final_due_date TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_date TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('PENDING', 'COMPLETED')) DEFAULT 'PENDING',
  FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);
```

### 3.4 API routes

- `POST /api/schedule/generate`: accept text, run local inference, and return a proposal without committing it.
- `POST /api/schedule/commit`: persist the approved proposal.
- `GET /api/events`: return active tasks for calendar rendering.
- `GET /api/schedule/export`: generate an iCalendar-compatible `.ics` response.

### 3.5 Visualization

- React with `@fullcalendar/react` and `@fullcalendar/daygrid`.
- Axios for API requests.
- Red markers for final deadlines and yellow markers for milestones.

## 4. Formal interface schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AcademicScheduleSchema",
  "type": "object",
  "properties": {
    "assignment_title": { "type": "string" },
    "final_due_date": { "type": "string", "format": "date" },
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "date": { "type": "string", "format": "date" },
          "description": { "type": "string" }
        },
        "required": ["title", "date", "description"]
      }
    }
  },
  "required": ["assignment_title", "final_due_date", "events"]
}
```

## 5. Non-functional requirements

- All operations, records, model weights, and parsing occur on the local system. Cloud inference and proxy APIs are prohibited.
- A complete text inference pass should remain under 4.5 seconds on Apple M-series unified memory or Nvidia RTX 3060-class hardware.

## 6. Delivery sequence

1. Establish Ollama and schema compliance.
2. Stand up FastAPI and SQLite.
3. Build the React calendar and UI actions.
4. Bind speech input and complete end-to-end verification.
