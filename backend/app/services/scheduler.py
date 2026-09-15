from typing import Protocol

from app.models import GenerateScheduleRequest, ScheduleProposal


class Scheduler(Protocol):
    async def generate(self, request: GenerateScheduleRequest) -> ScheduleProposal: ...

    async def status(self) -> str: ...
