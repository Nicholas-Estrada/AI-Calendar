# Software Requirements Specification

## Project: AI Calendar

**Version:** 2.0.0

**Date:** September 15, 2026

**Audience:** Product and engineering

## 1. Purpose

AI Calendar lets students quickly capture academic deadlines on a smartphone or computer, turn
them into reviewable milestone plans, and keep the approved events synchronized across devices.

Before a production launch, the product owner must define the supported age range and confirm
that the selected AI service terms permit that audience. The Gemini Developer API must not be
used for an audience prohibited by its current terms.

## 2. System topology

```text
React web app ── Firebase Authentication
       │
       ├──────── Cloud Firestore (account-scoped calendar data)
       │
       └──────── FastAPI ── Gemini API (structured schedule proposals)
                       └── Local Whisper (speech transcription)
```

A native mobile client may be added later. It will share Firebase data contracts and API schemas
with the web app rather than embedding the web interface.

## 3. Functional requirements

### 3.1 Authentication

- Support Google sign-in through Firebase Authentication.
- Prefer redirect authentication on narrow/mobile browser layouts.
- Keep the calendar unavailable until Firebase restores the user's session.
- Attach the Firebase ID token to protected FastAPI requests.
- Verify ID tokens on the backend before consuming Gemini quota.

### 3.2 Input and inference

- Accept natural-language academic deadlines through text and microphone input.
- Keep Gemini credentials exclusively on the FastAPI server.
- Ask Gemini for a strict `ScheduleProposal` and validate it with Pydantic.
- Treat every generated schedule as a draft until the student explicitly commits it.
- Return clear errors for missing configuration, rate limits, invalid model output, and outages.

### 3.3 Persistence and synchronization

- Store user profiles at `users/{uid}`.
- Store assignments at `users/{uid}/assignments/{assignmentId}`.
- Store renderable events at `users/{uid}/events/{eventId}`.
- Commit an approved assignment, milestones, and deadline atomically in one Firestore batch.
- Subscribe to Firestore updates so signed-in devices converge without manual refresh.
- Enforce owner-only access in Firestore Security Rules and deny unmatched paths.

SQLite endpoints remain temporarily for compatibility and may be removed after the Firestore
migration is accepted.

### 3.4 Calendar experience

- Show a full month grid on desktop.
- On small screens, keep quick-add and sign-in actions thumb-reachable.
- Distinguish milestones and deadlines through labels as well as color.
- Display interpreted dates before save and preserve all-day date semantics.
- Provide loading, empty, error, offline, and success states.

## 4. Schedule contract

```json
{
  "assignment_title": "Research essay",
  "final_due_date": "2026-09-20",
  "events": [
    {
      "title": "Complete outline",
      "date": "2026-09-14",
      "description": "Organize the thesis and supporting evidence."
    }
  ]
}
```

Milestones must not occur after the deadline. Titles, descriptions, list size, and raw prompt
length are bounded by the backend Pydantic models.

## 5. Security and privacy

- Never expose the Gemini key in browser or mobile bundles.
- Require Firebase Authentication for every protected API endpoint.
- Restrict Firestore documents to the authenticated UID.
- Add App Check before public production traffic.
- Avoid logging raw student prompts, tokens, or calendar content.
- Deploy Firestore rules and test cross-account denial before inviting external users.

## 6. Delivery sequence

1. Enable Google Authentication and create Firestore in Firebase Console.
2. Deploy and test Firestore rules.
3. Validate login and cross-device event synchronization.
4. Add a Gemini API key and run schedule-generation contract tests.
5. Complete responsive calendar editing and deletion.
6. Add the native mobile client and notification strategy.
