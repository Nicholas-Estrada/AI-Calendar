from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
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
from app.services.gemini import (
    GeminiScheduler,
    InferenceUnavailableError,
    InvalidInferenceError,
    get_scheduler,
)
from app.services.ical import build_calendar
from app.services.scheduler import Scheduler
from app.services.transcription import (
    LocalTranscriber,
    TranscriptionUnavailableError,
    get_transcriber,
)

router = APIRouter(prefix="/api", dependencies=[Depends(require_authenticated_user)])
MAX_AUDIO_BYTES = 15 * 1024 * 1024


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
