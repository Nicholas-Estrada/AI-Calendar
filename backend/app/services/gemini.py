from datetime import date

import httpx
from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from app.config import Settings
from app.models import GenerateScheduleRequest, ScheduleProposal


class InferenceUnavailableError(RuntimeError):
    pass


class InvalidInferenceError(RuntimeError):
    pass


class GeminiScheduler:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def status(self) -> str:
        return "configured" if self.settings.gemini_api_key else "not_configured"

    async def generate(self, request: GenerateScheduleRequest) -> ScheduleProposal:
        if not self.settings.gemini_api_key:
            raise InferenceUnavailableError(
                "Gemini is not configured yet. Add LIAS_GEMINI_API_KEY to backend/.env."
            )

        base_date = request.base_date or date.today()
        client = genai.Client(
            api_key=self.settings.gemini_api_key.get_secret_value(),
            http_options=types.HttpOptions(
                timeout=int(self.settings.gemini_timeout_seconds * 1_000),
                retry_options=types.HttpRetryOptions(
                    attempts=3,
                    initial_delay=1,
                    max_delay=8,
                    http_status_codes=[408, 429, 500, 502, 503, 504],
                ),
            ),
        )
        async_client = client.aio

        try:
            response = await async_client.models.generate_content(
                model=self.settings.gemini_model,
                contents=self._build_prompt(request.text, base_date),
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are a careful academic planning engine. Return a practical "
                        "schedule that follows the supplied schema. Never invent a deadline "
                        "when the student's input is ambiguous."
                    ),
                    temperature=0,
                    response_mime_type="application/json",
                    response_json_schema=ScheduleProposal.model_json_schema(),
                ),
            )
        except errors.APIError as error:
            if error.code in (401, 403):
                message = (
                    "Gemini rejected the API key or its permissions. "
                    "Check the key in backend/.env."
                )
            elif error.code == 404:
                message = (
                    f"Gemini model {self.settings.gemini_model} is unavailable to this API key."
                )
            elif error.code == 429:
                message = (
                    "Gemini's quota or rate limit was reached. Check your usage and try later."
                )
            elif error.code == 400:
                message = (
                    "Gemini rejected the schedule request. Check the configured model and schema."
                )
            elif error.code == 503:
                message = "Gemini is busy right now. Please retry your plan in a moment."
            else:
                message = "Gemini could not build a schedule right now. Please try again shortly."
            raise InferenceUnavailableError(message) from error
        except (httpx.HTTPError, TimeoutError) as error:
            raise InferenceUnavailableError(
                "The server could not reach Gemini. Check its network connection and try again."
            ) from error
        finally:
            await async_client.aclose()

        try:
            if isinstance(response.parsed, ScheduleProposal):
                return response.parsed
            if not response.text:
                raise ValueError("Gemini returned an empty response")
            return ScheduleProposal.model_validate_json(response.text)
        except (TypeError, ValueError, ValidationError) as error:
            raise InvalidInferenceError(
                "Gemini returned a schedule that could not be safely validated."
            ) from error

    @staticmethod
    def _build_prompt(raw_text: str, base_date: date) -> str:
        return f"""
Current local date: {base_date.isoformat()}
Student input: {raw_text}

Resolve relative dates against the current local date. If the deadline is not clear, make the
assignment title explain what clarification is needed and do not guess a date. Produce useful
milestones between the current date and the final deadline. For essays, consider brainstorming,
outline, draft, review, and polish phases. For exams, consider concept compilation, active recall,
spaced review, and a timed mock exam. Use concise titles and actionable descriptions. The final
deadline is represented by final_due_date, so do not duplicate it in events.
""".strip()


def get_scheduler(settings: Settings) -> GeminiScheduler:
    return GeminiScheduler(settings)
