from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GenerateScheduleRequest(StrictModel):
    text: str = Field(min_length=3, max_length=8_000)
    base_date: date | None = None


class MilestoneProposal(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    date: date
    description: str = Field(min_length=1, max_length=1_000)


class ScheduleProposal(StrictModel):
    assignment_title: str = Field(min_length=1, max_length=200)
    final_due_date: date
    events: list[MilestoneProposal] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def validate_event_dates(self) -> "ScheduleProposal":
        if any(event.date > self.final_due_date for event in self.events):
            raise ValueError("Milestones cannot occur after the final due date")
        self.events.sort(key=lambda event: event.date)
        return self


class MilestoneStatus(StrEnum):
    pending = "PENDING"
    completed = "COMPLETED"


class Assignment(StrictModel):
    id: str
    title: str
    raw_prompt: str | None
    final_due_date: date
    created_at: datetime


class Milestone(StrictModel):
    id: str
    assignment_id: str
    title: str
    target_date: date
    description: str | None
    status: MilestoneStatus


class CommitScheduleRequest(ScheduleProposal):
    raw_prompt: str | None = Field(default=None, max_length=8_000)


class CommittedSchedule(StrictModel):
    assignment: Assignment
    milestones: list[Milestone]


class CalendarEvent(StrictModel):
    id: str
    title: str
    start: date
    allDay: bool = True
    backgroundColor: str
    borderColor: str
    extendedProps: dict[str, str]


class HealthResponse(StrictModel):
    status: str
    inference: str
    authentication: str


class TranscriptionResponse(StrictModel):
    text: str
