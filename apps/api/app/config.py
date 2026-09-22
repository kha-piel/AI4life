from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    vision_provider: Literal["fixture", "openai"] = "fixture"
    allow_fixture_fallback: bool = True
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-6-astra"
    openai_base_url: str = "https://api.openai.com/v1"
    provider_timeout_seconds: float = 12.0
    max_upload_bytes: int = 5 * 1024 * 1024
    rate_limit_requests: int = 30
    rate_limit_window_seconds: int = 60
    allowed_origins: str = "http://localhost:8081,http://localhost:19006"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def allowed_origin_list(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

