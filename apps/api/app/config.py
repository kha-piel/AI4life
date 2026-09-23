from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    vision_provider: Literal["fixture", "groq", "openai"] = "groq"
    allow_fixture_fallback: bool = False
    groq_api_key: SecretStr | None = None
    groq_model: str = "qwen/qwen3.8-27b"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-6-astra"
    openai_base_url: str = "https://api.openai.com/v1"
    provider_timeout_seconds: float = 30.0
    require_app_auth: bool = False
    app_access_token_hashes: str = ""
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

    @property
    def app_access_token_hash_set(self) -> frozenset[str]:
        return frozenset(
            item.strip().casefold()
            for item in self.app_access_token_hashes.split(",")
            if len(item.strip()) == 64
            and all(character in "0123456789abcdefABCDEF" for character in item.strip())
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
