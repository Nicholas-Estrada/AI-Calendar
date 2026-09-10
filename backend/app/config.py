from functools import lru_cache
from pathlib import Path

from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Local Intelligent Academic Scheduler"
    database_path: Path = Path("./data/lias.sqlite3")
    ollama_base_url: AnyHttpUrl = AnyHttpUrl("http://127.0.0.1:11434")
    ollama_model: str = "llama3.1:8b"
    ollama_timeout_seconds: float = 4.5
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="LIAS_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
