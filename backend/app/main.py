from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.config import Settings, get_settings
from app.database import initialize_database
from app.models import HealthResponse
from app.services.ollama import OllamaScheduler


def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        initialize_database(active_settings.database_path)
        yield

    application = FastAPI(
        title=active_settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[active_settings.frontend_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    application.include_router(router)
    application.dependency_overrides[get_settings] = lambda: active_settings

    @application.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        scheduler = OllamaScheduler(active_settings)
        return HealthResponse(status="ok", ollama=await scheduler.status())

    return application


app = create_app()
