from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import scheduler_dependency, transcriber_dependency
from app.config import Settings
from app.main import create_app
from app.models import GenerateScheduleRequest, MilestoneProposal, ScheduleProposal


class FakeScheduler:
    async def generate(self, request: GenerateScheduleRequest) -> ScheduleProposal:
        assert request.text
        return ScheduleProposal(
            assignment_title="Research essay",
            final_due_date=date(2026, 9, 20),
            events=[
                MilestoneProposal(
                    title="Draft thesis",
                    date=date(2026, 9, 12),
                    description="Choose a position and supporting claims.",
                ),
                MilestoneProposal(
                    title="Complete first draft",
                    date=date(2026, 9, 17),
                    description="Write the complete initial draft.",
                ),
            ],
        )


class FakeTranscriber:
    def transcribe(self, audio: bytes) -> str:
        assert audio == b"recorded audio"
        return "History essay due September 20"


def make_client(database_path: Path) -> TestClient:
    settings = Settings(database_path=database_path, firebase_auth_required=False)
    app = create_app(settings)
    app.dependency_overrides[scheduler_dependency] = lambda: FakeScheduler()
    app.dependency_overrides[transcriber_dependency] = lambda: FakeTranscriber()
    return TestClient(app)


def test_generate_commit_events_and_export(tmp_path: Path) -> None:
    with make_client(tmp_path / "test.sqlite3") as client:
        generated = client.post(
            "/api/schedule/generate", json={"text": "Essay due September 20"}
        )
        assert generated.status_code == 200
        assert generated.json()["assignment_title"] == "Research essay"

        committed = client.post(
            "/api/schedule/commit",
            json={**generated.json(), "raw_prompt": "Essay due September 20"},
        )
        assert committed.status_code == 201
        assert len(committed.json()["milestones"]) == 2

        events = client.get("/api/events")
        assert events.status_code == 200
        assert len(events.json()) == 3
        assert {event["extendedProps"]["kind"] for event in events.json()} == {
            "deadline",
            "milestone",
        }

        exported = client.get("/api/schedule/export")
        assert exported.status_code == 200
        assert exported.headers["content-type"].startswith("text/calendar")
        assert b"BEGIN:VCALENDAR" in exported.content
        assert b"Research essay" in exported.content


def test_rejects_milestone_after_deadline(tmp_path: Path) -> None:
    with make_client(tmp_path / "test.sqlite3") as client:
        response = client.post(
            "/api/schedule/commit",
            json={
                "assignment_title": "Invalid schedule",
                "final_due_date": "2026-09-20",
                "events": [
                    {
                        "title": "Late milestone",
                        "date": "2026-09-21",
                        "description": "This should fail.",
                    }
                ],
            },
        )
        assert response.status_code == 422


def test_transcribes_uploaded_audio_locally(tmp_path: Path) -> None:
    with make_client(tmp_path / "test.sqlite3") as client:
        response = client.post(
            "/api/transcribe",
            files={"audio": ("recording.webm", b"recorded audio", "audio/webm")},
        )

        assert response.status_code == 200
        assert response.json() == {"text": "History essay due September 20"}


def test_rejects_non_audio_upload(tmp_path: Path) -> None:
    with make_client(tmp_path / "test.sqlite3") as client:
        response = client.post(
            "/api/transcribe",
            files={"audio": ("notes.txt", b"recorded audio", "text/plain")},
        )

        assert response.status_code == 415


def test_requires_authentication_by_default(tmp_path: Path) -> None:
    app = create_app(Settings(database_path=tmp_path / "test.sqlite3"))
    app.dependency_overrides[scheduler_dependency] = lambda: FakeScheduler()

    with TestClient(app) as client:
        response = client.post(
            "/api/schedule/generate",
            json={"text": "Essay due September 20"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Sign in before using the AI Calendar API."


def test_health_reports_unconfigured_gemini(tmp_path: Path) -> None:
    app = create_app(
        Settings(
            database_path=tmp_path / "test.sqlite3",
            firebase_auth_required=False,
            gemini_api_key=None,
        )
    )

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "inference": "not_configured",
        "authentication": "development_bypass",
    }
