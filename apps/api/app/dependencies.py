from typing import Annotated

from fastapi import Depends

from app.config import Settings, get_settings
from app.providers import build_provider
from app.providers.base import VisionProvider


def get_provider(
    settings: Annotated[Settings, Depends(get_settings)],
) -> VisionProvider:
    # A provider instance is scoped to one request so fallback metadata cannot
    # leak across concurrent analyses.
    return build_provider(settings)

