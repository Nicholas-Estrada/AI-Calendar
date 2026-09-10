from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.config import Settings, get_settings
from app.database import commit_schedule, list_calendar_events
from app.models import (
    CalendarEvent,
    CommitScheduleRequest,
    CommittedSchedule,
    GenerateScheduleRequest,
    ScheduleProposal,
)
from app.services.ical import build_calendar
from app.services.ollama import (
    InferenceUnavailableError,
    InvalidInferenceError,
    OllamaScheduler,
    get_scheduler,
)

router = APIRouter(prefix="/api")


def scheduler_dependency(
    settings: Annotated[Settings, Depends(get_settings)],
) -> OllamaScheduler:
    return get_scheduler(settings)


@router.post("/schedule/generate", response_model=ScheduleProposal)
async def generate_schedule(
    request: GenerateScheduleRequest,
    scheduler: Annotated[OllamaScheduler, Depends(scheduler_dependency)],
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
