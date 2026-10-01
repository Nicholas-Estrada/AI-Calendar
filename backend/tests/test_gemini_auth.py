import asyncio
import json
from datetime import date
from types import SimpleNamespace

import pytest
from google.auth.credentials import AnonymousCredentials
from google.genai import errors
from pydantic import SecretStr

from app.auth import _firebase_verifier_app
from app.config import Settings
from app.models import GenerateScheduleRequest
from app.services.gemini import GeminiScheduler, InferenceUnavailableError


def test_gemini_generates_valid_schedule_with_json_schema(monkeypatch) -> None:
    async def generate_content(*, model, contents, config):
        assert model == "gemini-test"
        assert "Math quiz" in contents
        assert config.response_json_schema["properties"]["events"]["maxItems"] == 20
        assert config.response_schema is None
        return SimpleNamespace(
            parsed=None,
            text=json.dumps(
                {
                    "assignment_title": "Math quiz",
                    "final_due_date": "2026-09-23",
                    "events": [
                        {
                            "title": "Practice problems",
                            "date": "2026-09-20",
                            "description": "Solve a set of sample problems.",
                        }
                    ],
                }
            ),
        )

    async def aclose():
        pass

    client = SimpleNamespace(
        aio=SimpleNamespace(
            models=SimpleNamespace(generate_content=generate_content), aclose=aclose
        )
    )
    monkeypatch.setattr("app.services.gemini.genai.Client", lambda **kwargs: client)
    scheduler = GeminiScheduler(
        Settings(gemini_api_key=SecretStr("test-key"), gemini_model="gemini-test")
    )

    result = asyncio.run(
        scheduler.generate(
            GenerateScheduleRequest(text="Math quiz on September 23", base_date=date(2026, 9, 16))
        )
    )

    assert result.assignment_title == "Math quiz"
    assert result.events[0].date == date(2026, 9, 20)


def test_gemini_reports_temporary_provider_overload(monkeypatch) -> None:
    async def generate_content(**kwargs):
        raise errors.ServerError(503, {"error": {"message": "model overloaded"}})

    async def aclose():
        pass

    client = SimpleNamespace(
        aio=SimpleNamespace(
            models=SimpleNamespace(generate_content=generate_content), aclose=aclose
        )
    )
    monkeypatch.setattr("app.services.gemini.genai.Client", lambda **kwargs: client)
    scheduler = GeminiScheduler(Settings(gemini_api_key=SecretStr("test-key")))

    with pytest.raises(InferenceUnavailableError, match="Gemini is busy"):
        asyncio.run(scheduler.generate(GenerateScheduleRequest(text="Math quiz next week")))


def test_firebase_token_verifier_does_not_need_application_default_credentials(
    monkeypatch,
) -> None:
    def no_default_credentials(*args, **kwargs):
        raise AssertionError("Token verification should not request server credentials")

    monkeypatch.setattr("google.auth.default", no_default_credentials)
    verifier = _firebase_verifier_app("ai-calendar-verifier-test")

    assert verifier.project_id == "ai-calendar-verifier-test"
    assert isinstance(verifier.credential.get_credential(), AnonymousCredentials)
