from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Calendar API"
    database_path: Path = Path("./data/lias.sqlite3")
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: float = 60
    firebase_project_id: str = "lias-abff9"
    firebase_auth_required: bool = True
    whisper_model: str = "tiny.en"
    whisper_model_path: Path = Path("./data/models/faster-whisper-tiny.en")
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="LIAS_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
