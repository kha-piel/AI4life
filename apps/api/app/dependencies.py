from typing import Annotated

from fastapi import Depends

from app.config import Settings, get_settings
from app.errors import ApiError, VisionProviderConfigurationError
from app.providers import build_provider
from app.providers.base import VisionProvider


def get_provider(
    settings: Annotated[Settings, Depends(get_settings)],
) -> VisionProvider:
    # A provider instance is scoped to one request so fallback metadata cannot
    # leak across concurrent analyses.
    try:
        return build_provider(settings)
    except VisionProviderConfigurationError as exc:
        raise ApiError(
            503,
            "provider_not_configured",
            "AI phân tích ảnh thật chưa được cấu hình. Hãy kiểm tra API key của provider.",
        ) from exc
