import asyncio
import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from app.auth import require_app_access, validate_access_settings
from app.config import Settings, get_settings
from app.dependencies import get_provider
from app.errors import (
    ApiError,
    AppConfigurationError,
    VisionProviderConfigurationError,
    VisionProviderError,
)
from app.providers.base import VisionProvider
from app.providers.factory import validate_provider_settings
from app.schemas import (
    ApiResponse,
    AccessData,
    HealthData,
    LabelAnalysis,
    LabelTarget,
)
from app.validation import validate_image


logger = logging.getLogger(__name__)
router = APIRouter()
MAX_LABEL_IMAGES = 3
MAX_TOTAL_IMAGE_BYTES = 12 * 1024 * 1024


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
    try:
        validate_provider_settings(settings)
    except VisionProviderConfigurationError as exc:
        raise ApiError(
            503,
            "provider_not_configured",
            "AI phân tích ảnh thật chưa được cấu hình. Hãy kiểm tra API key của provider.",
        ) from exc
    try:
        validate_access_settings(settings)
    except AppConfigurationError as exc:
        raise ApiError(
            503,
            "app_auth_not_configured",
            "Máy chủ chưa cấu hình quyền truy cập ứng dụng.",
        ) from exc
    return ApiResponse(
        success=True,
        data=HealthData(provider=settings.vision_provider),
        error=None,
    )


@router.get("/v1/access-check", response_model=ApiResponse[AccessData])
async def access_check(
    _: Annotated[None, Depends(require_app_access)],
):
    return ApiResponse(
        success=True,
        data=AccessData(),
        error=None,
    )


@router.post("/v1/analyze-label", response_model=ApiResponse[LabelAnalysis])
async def analyze_label(
    request: Request,
    provider: Annotated[VisionProvider, Depends(get_provider)],
    settings: Annotated[Settings, Depends(get_settings)],
    _: Annotated[None, Depends(require_app_access)],
    image: Annotated[UploadFile | None, File()] = None,
    images: Annotated[list[UploadFile] | None, File()] = None,
    ocr_text: Annotated[str | None, Form()] = None,
    locale: Annotated[str, Form()] = "vi-VN",
    requested_field: Annotated[LabelTarget, Form()] = LabelTarget.ALL,
):
    started = time.monotonic()
    uploads = ([image] if image is not None else []) + (images or [])
    if not uploads:
        raise ApiError(422, "image_required", "Hãy gửi ít nhất một ảnh nhãn.")
    if len(uploads) > MAX_LABEL_IMAGES:
        raise ApiError(
            422,
            "too_many_images",
            f"Mỗi lượt chỉ hỗ trợ tối đa {MAX_LABEL_IMAGES} ảnh.",
        )
    image_inputs = [await _read_image(upload, settings) for upload in uploads]
    if sum(len(data) for data, _ in image_inputs) > MAX_TOTAL_IMAGE_BYTES:
        raise ApiError(
            413,
            "images_too_large",
            "Tổng dung lượng ảnh vượt quá 12 MB. Hãy chọn ảnh nhỏ hơn.",
        )
    try:
        result = await asyncio.wait_for(
            provider.analyze_label(
                image_inputs, ocr_text, locale, requested_field
            ),
            timeout=settings.provider_timeout_seconds * 2,
        )
    except TimeoutError as exc:
        logger.warning(
            "label_analysis_timeout request_id=%s requested_field=%s",
            request.state.request_id,
            requested_field.value,
        )
        raise ApiError(504, "provider_timeout", "AI phản hồi quá chậm. Hãy thử lại.") from exc
    except VisionProviderError as exc:
        logger.warning(
            "label_analysis_provider_failure request_id=%s requested_field=%s",
            request.state.request_id,
            requested_field.value,
        )
        raise ApiError(
            502, "provider_failure", "Không thể phân tích ảnh lúc này."
        ) from exc

    provider_name, demo_mode = _provider_metadata(provider)
    elapsed_ms = round((time.monotonic() - started) * 1000)
    logger.info(
        "label_analysis_completed request_id=%s requested_field=%s image_count=%s provider=%s demo_mode=%s latency_ms=%s",
        request.state.request_id,
        requested_field.value,
        len(image_inputs),
        provider_name,
        demo_mode,
        elapsed_ms,
    )
    analysis = LabelAnalysis(
        **result.model_dump(),
        requested_field=requested_field,
        image_count=len(image_inputs),
        request_id=request.state.request_id,
        provider=provider_name,
        demo_mode=demo_mode,
    )
    return ApiResponse(success=True, data=analysis, error=None)
