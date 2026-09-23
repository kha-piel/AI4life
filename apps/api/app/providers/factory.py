from app.config import Settings
from app.errors import VisionProviderConfigurationError
from app.providers.base import VisionProvider
from app.providers.fallback import FallbackVisionProvider
from app.providers.fixture import FixtureVisionProvider
from app.providers.groq import GroqVisionProvider
from app.providers.openai import OpenAIVisionProvider


def validate_provider_settings(settings: Settings) -> None:
    if settings.vision_provider == "fixture":
        return

    if settings.vision_provider == "groq":
        if settings.groq_api_key is None or not settings.groq_api_key.get_secret_value():
            raise VisionProviderConfigurationError(
                "GROQ_API_KEY is required when VISION_PROVIDER=groq"
            )
        return

    if settings.openai_api_key is None or not settings.openai_api_key.get_secret_value():
        raise VisionProviderConfigurationError(
            "OPENAI_API_KEY is required when VISION_PROVIDER=openai"
        )


def build_provider(settings: Settings) -> VisionProvider:
    validate_provider_settings(settings)

    if settings.vision_provider == "fixture":
        return FixtureVisionProvider()

    if settings.vision_provider == "groq":
        provider: VisionProvider = GroqVisionProvider(
            api_key=settings.groq_api_key.get_secret_value(),
            model=settings.groq_model,
            base_url=settings.groq_base_url,
            timeout_seconds=settings.provider_timeout_seconds,
        )
    else:
        provider = OpenAIVisionProvider(
            api_key=settings.openai_api_key.get_secret_value(),
            model=settings.openai_model,
            base_url=settings.openai_base_url,
            timeout_seconds=settings.provider_timeout_seconds,
        )
    if settings.allow_fixture_fallback:
        return FallbackVisionProvider(provider, settings.provider_timeout_seconds)
    return provider
