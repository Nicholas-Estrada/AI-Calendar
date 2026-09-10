import json
from datetime import date

import httpx
from pydantic import ValidationError

from app.config import Settings
from app.models import GenerateScheduleRequest, ScheduleProposal


class InferenceUnavailableError(RuntimeError):
    pass


class InvalidInferenceError(RuntimeError):
    pass


class OllamaScheduler:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def status(self) -> str:
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                response = await client.get(f"{self.settings.ollama_base_url}api/tags")
                response.raise_for_status()
                installed_models = {
                    model.get("name") for model in response.json().get("models", [])
                }
                if self.settings.ollama_model not in installed_models:
                    return "model_missing"
                return "available"
        except (httpx.HTTPError, TypeError, ValueError):
            return "unavailable"

    async def generate(self, request: GenerateScheduleRequest) -> ScheduleProposal:
        base_date = request.base_date or date.today()
        schema = ScheduleProposal.model_json_schema()
        prompt = self._build_prompt(request.text, base_date)
        payload = {
            "model": self.settings.ollama_model,
            "stream": False,
            "format": schema,
            "options": {"temperature": 0},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a deterministic academic planning engine. Return only JSON "
                        "that conforms exactly to the supplied schema. Never invent a deadline "
                        "when the input is ambiguous."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        }

        try:
            async with httpx.AsyncClient(
                timeout=self.settings.ollama_timeout_seconds
            ) as client:
                response = await client.post(
                    f"{self.settings.ollama_base_url}api/chat", json=payload
                )
                response.raise_for_status()
        except (httpx.ConnectError, httpx.TimeoutException) as error:
            raise InferenceUnavailableError(
                "Ollama is unavailable. Start it locally and confirm the configured model exists."
            ) from error
        except httpx.HTTPStatusError as error:
            raise InferenceUnavailableError(
                f"Ollama rejected the request with status {error.response.status_code}."
            ) from error

        try:
            content = response.json()["message"]["content"]
            return ScheduleProposal.model_validate(json.loads(content))
        except (KeyError, TypeError, json.JSONDecodeError, ValidationError) as error:
            raise InvalidInferenceError(
                "The local model returned a response that did not match the schedule schema."
            ) from error

    @staticmethod
    def _build_prompt(raw_text: str, base_date: date) -> str:
        return f"""
Current local date: {base_date.isoformat()}
Student input: {raw_text}

Resolve relative dates against the current local date. Produce useful milestones between the
current date and the final deadline. For essays, use brainstorming/thesis, outline, draft,
review, and polish phases. For exams, use concept compilation, active recall, spaced review,
and a timed mock exam. Use concise titles and actionable descriptions. The final deadline is
represented by final_due_date, so do not duplicate it in events.
""".strip()


def get_scheduler(settings: Settings) -> OllamaScheduler:
    return OllamaScheduler(settings)
