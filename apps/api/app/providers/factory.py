from app.config import Settings
from app.providers.base import VisionProvider
from app.providers.fallback import FallbackVisionProvider
from app.providers.fixture import FixtureVisionProvider
from app.providers.openai import OpenAIVisionProvider


def build_provider(settings: Settings) -> VisionProvider:
    if settings.vision_provider == "fixture":
        return FixtureVisionProvider()

    if settings.openai_api_key is None or not settings.openai_api_key.get_secret_value():
        raise RuntimeError(
            "OPENAI_API_KEY is required when VISION_PROVIDER=openai"
        )

    provider: VisionProvider = OpenAIVisionProvider(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_model,
        base_url=settings.openai_base_url,
        timeout_seconds=settings.provider_timeout_seconds,
    )
    if settings.allow_fixture_fallback:
        return FallbackVisionProvider(provider, settings.provider_timeout_seconds)
    return provider
