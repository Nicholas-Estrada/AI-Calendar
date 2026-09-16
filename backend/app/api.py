from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.auth import require_authenticated_user
from app.config import Settings, get_settings
from app.database import commit_schedule, list_calendar_events
from app.models import (
    CalendarEvent,
    CommitScheduleRequest,
    CommittedSchedule,
    GenerateScheduleRequest,
    ScheduleProposal,
    TranscriptionResponse,
)
from app.services.calendar_feed import (
    ensure_subscription_token,
    events_for_subscription,
    reset_subscription_token,
)
from app.services.gemini import (
    GeminiScheduler,
    InferenceUnavailableError,
    InvalidInferenceError,
    get_scheduler,
)
from app.services.ical import build_calendar, build_firestore_calendar
from app.services.scheduler import Scheduler
from app.services.transcription import (
    LocalTranscriber,
    TranscriptionUnavailableError,
    get_transcriber,
)

router = APIRouter(prefix="/api", dependencies=[Depends(require_authenticated_user)])
public_router = APIRouter(prefix="/api")
MAX_AUDIO_BYTES = 15 * 1024 * 1024


def subscription_url(request: Request, token: str, settings: Settings) -> str:
    if settings.public_api_origin:
        return f"{settings.public_api_origin.rstrip('/')}/api/calendar/feed/{token}.ics"
    return str(request.url_for("get_calendar_subscription", token=token))


@router.post("/calendar/subscription")
async def create_calendar_subscription(
    request: Request,
    user: Annotated[dict, Depends(require_authenticated_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    if user.get("firebase", {}).get("sign_in_provider") == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest calendars stay on this device. Export an iCalendar file instead.",
        )
    try:
        token = await run_in_threadpool(
            ensure_subscription_token, user["uid"], settings.firebase_project_id
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The calendar subscription could not be created right now.",
        ) from error
    return {"url": subscription_url(request, token, settings)}


@router.post("/calendar/subscription/reset")
async def reset_calendar_subscription(
    request: Request,
    user: Annotated[dict, Depends(require_authenticated_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    if user.get("firebase", {}).get("sign_in_provider") == "anonymous":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    try:
        token = await run_in_threadpool(
            reset_subscription_token, user["uid"], settings.firebase_project_id
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The calendar subscription could not be reset right now.",
        ) from error
    return {"url": subscription_url(request, token, settings)}


@public_router.get("/calendar/feed/{token}.ics")
async def get_calendar_subscription(
    token: str,
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    try:
        feed = await run_in_threadpool(
            events_for_subscription, token, settings.firebase_project_id
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The calendar subscription is temporarily unavailable.",
        ) from error
    if feed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    events, timezone = feed
    return Response(
        content=build_firestore_calendar(events, timezone),
        media_type="text/calendar",
        headers={
            "Content-Disposition": 'inline; filename="ai-calendar.ics"',
            "Cache-Control": "private, max-age=300",
        },
    )


def scheduler_dependency(
    settings: Annotated[Settings, Depends(get_settings)],
) -> GeminiScheduler:
    return get_scheduler(settings)


def transcriber_dependency(
    settings: Annotated[Settings, Depends(get_settings)],
) -> LocalTranscriber:
    return get_transcriber(settings)


@router.post("/schedule/generate", response_model=ScheduleProposal)
async def generate_schedule(
    request: GenerateScheduleRequest,
    scheduler: Annotated[Scheduler, Depends(scheduler_dependency)],
) -> ScheduleProposal:
    try:
        return await scheduler.generate(request)
    except InferenceUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error
    except InvalidInferenceError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio: Annotated[UploadFile, File(description="Recorded microphone audio")],
    transcriber: Annotated[LocalTranscriber, Depends(transcriber_dependency)],
) -> TranscriptionResponse:
    if audio.content_type and not audio.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="The uploaded file must contain audio.",
        )

    contents = await audio.read(MAX_AUDIO_BYTES + 1)
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The recording was empty. Please try again.",
        )
    if len(contents) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="The recording is too large. Keep dictation under a few minutes.",
        )

    try:
        text = await run_in_threadpool(transcriber.transcribe, contents)
    except TranscriptionUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error

    return TranscriptionResponse(text=text)


@router.post(
    "/schedule/commit",
    response_model=CommittedSchedule,
    status_code=status.HTTP_201_CREATED,
)
def save_schedule(
    request: CommitScheduleRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> CommittedSchedule:
    return commit_schedule(settings.database_path, request)


@router.get("/events", response_model=list[CalendarEvent])
def get_events(
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[CalendarEvent]:
    return list_calendar_events(settings.database_path)


@router.get("/schedule/export")
def export_schedule(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    payload = build_calendar(list_calendar_events(settings.database_path))
    return Response(
        content=payload,
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="lias-schedule.ics"'},
    )
