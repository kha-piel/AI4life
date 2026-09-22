import asyncio
import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from app.config import Settings, get_settings
from app.dependencies import get_provider
from app.errors import ApiError, VisionProviderError
from app.providers.base import VisionProvider
from app.schemas import (
    ApiResponse,
    HealthData,
    LabelAnalysis,
    SceneAnalysis,
)
from app.validation import validate_image


logger = logging.getLogger(__name__)
router = APIRouter()


def _provider_metadata(provider: VisionProvider) -> tuple[str, bool]:
    name = getattr(provider, "last_provider", provider.name)
    demo_mode = getattr(provider, "last_demo_mode", provider.demo_mode)
    return name, demo_mode


async def _read_image(
    image: UploadFile,
    settings: Settings,
) -> tuple[bytes, str]:
    data = await image.read(settings.max_upload_bytes + 1)
    mime_type = validate_image(data, image.content_type, settings.max_upload_bytes)
    return data, mime_type


@router.get("/health", response_model=ApiResponse[HealthData])
async def health(settings: Annotated[Settings, Depends(get_settings)]):
    return ApiResponse(
        success=True,
        data=HealthData(provider=settings.vision_provider),
        error=None,
    )


@router.post("/v1/analyze-label", response_model=ApiResponse[LabelAnalysis])
async def analyze_label(
    request: Request,
    image: Annotated[UploadFile, File(...)],
    provider: Annotated[VisionProvider, Depends(get_provider)],
    settings: Annotated[Settings, Depends(get_settings)],
    ocr_text: Annotated[str | None, Form()] = None,
    locale: Annotated[str, Form()] = "vi-VN",
):
    started = time.monotonic()
    data, mime_type = await _read_image(image, settings)
    try:
        result = await asyncio.wait_for(
            provider.analyze_label(data, mime_type, ocr_text, locale),
            timeout=settings.provider_timeout_seconds * 2,
        )
    except TimeoutError as exc:
        raise ApiError(504, "provider_timeout", "AI phản hồi quá chậm. Hãy thử lại.") from exc
    except VisionProviderError as exc:
        raise ApiError(
            502, "provider_failure", "Không thể phân tích ảnh lúc này."
        ) from exc

    provider_name, demo_mode = _provider_metadata(provider)
    elapsed_ms = round((time.monotonic() - started) * 1000)
    logger.info(
        "label_analysis_completed request_id=%s provider=%s demo_mode=%s latency_ms=%s",
        request.state.request_id,
        provider_name,
        demo_mode,
        elapsed_ms,
    )
    analysis = LabelAnalysis(
        **result.model_dump(),
        request_id=request.state.request_id,
        provider=provider_name,
        demo_mode=demo_mode,
    )
    return ApiResponse(success=True, data=analysis, error=None)


@router.post("/v1/analyze-scene", response_model=ApiResponse[SceneAnalysis])
async def analyze_scene(
    request: Request,
    image: Annotated[UploadFile, File(...)],
    provider: Annotated[VisionProvider, Depends(get_provider)],
    settings: Annotated[Settings, Depends(get_settings)],
    locale: Annotated[str, Form()] = "vi-VN",
):
    started = time.monotonic()
    data, mime_type = await _read_image(image, settings)
    try:
        result = await asyncio.wait_for(
            provider.analyze_scene(data, mime_type, locale),
            timeout=settings.provider_timeout_seconds * 2,
        )
    except TimeoutError as exc:
        raise ApiError(504, "provider_timeout", "AI phản hồi quá chậm. Hãy thử lại.") from exc
    except VisionProviderError as exc:
        raise ApiError(
            502, "provider_failure", "Không thể phân tích cảnh lúc này."
        ) from exc

    provider_name, demo_mode = _provider_metadata(provider)
    elapsed_ms = round((time.monotonic() - started) * 1000)
    logger.info(
        "scene_analysis_completed request_id=%s provider=%s demo_mode=%s latency_ms=%s",
        request.state.request_id,
        provider_name,
        demo_mode,
        elapsed_ms,
    )
    analysis = SceneAnalysis(
        **result.model_dump(),
        request_id=request.state.request_id,
        provider=provider_name,
        demo_mode=demo_mode,
    )
    return ApiResponse(success=True, data=analysis, error=None)
