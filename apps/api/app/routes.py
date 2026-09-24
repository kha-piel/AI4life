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
    HealthAssessment,
    HealthCondition,
    HealthVerdict,
    HealthData,
    LabelAnalysis,
    LabelProviderResult,
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


def _apply_health_safety(
    result: LabelProviderResult, health_condition: HealthCondition | None
) -> LabelProviderResult:
    if health_condition is None:
        return result.model_copy(update={"health_assessment": None})

    assessment = result.health_assessment
    facts = result.nutrition_facts
    has_minimum_diabetes_evidence = (
        bool(facts.serving_size) and facts.total_carbohydrate_g is not None
    )
    if health_condition == HealthCondition.DIABETES and not has_minimum_diabetes_evidence:
        missing = list(assessment.missing_information if assessment else [])
        if not facts.serving_size and "Khẩu phần" not in missing:
            missing.append("Khẩu phần")
        if facts.total_carbohydrate_g is None and "Tổng carbohydrate" not in missing:
            missing.append("Tổng carbohydrate")
        safe_assessment = HealthAssessment(
            condition=health_condition,
            verdict=HealthVerdict.UNCERTAIN,
            summary=(
                "Chưa đủ khẩu phần và tổng carbohydrate để đánh giá sản phẩm "
                "cho người tiểu đường."
            ),
            reasons=assessment.reasons if assessment else [],
            ingredient_assessments=(
                assessment.ingredient_assessments if assessment else []
            ),
            missing_information=missing[:6],
        )
        speech_text = result.speech_text
        if "chưa đủ" not in speech_text.casefold() or "tiểu đường" not in speech_text.casefold():
            speech_text += (
                " Chưa đủ bảng dinh dưỡng để đánh giá cho người tiểu đường; "
                "hãy chụp rõ khẩu phần và tổng carbohydrate."
            )
        return result.model_copy(
            update={
                "health_assessment": safe_assessment,
                "speech_text": speech_text[:800],
            }
        )

    if assessment is None:
        assessment = HealthAssessment(
            condition=health_condition,
            verdict=HealthVerdict.UNCERTAIN,
            summary="AI không tạo được đánh giá sức khỏe đáng tin cậy từ nhãn này.",
            reasons=[],
            ingredient_assessments=[],
            missing_information=["Đánh giá sức khỏe có căn cứ"],
        )
    elif assessment.condition != health_condition:
        assessment = assessment.model_copy(update={"condition": health_condition})
    return result.model_copy(update={"health_assessment": assessment})


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
    health_condition: Annotated[HealthCondition | None, Form()] = None,
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
                image_inputs, ocr_text, locale, requested_field, health_condition
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
        "label_analysis_completed request_id=%s requested_field=%s image_count=%s health_assessment_requested=%s provider=%s demo_mode=%s latency_ms=%s",
        request.state.request_id,
        requested_field.value,
        len(image_inputs),
        health_condition is not None,
        provider_name,
        demo_mode,
        elapsed_ms,
    )
    safe_result = _apply_health_safety(result, health_condition)
    analysis = LabelAnalysis(
        **safe_result.model_dump(),
        requested_field=requested_field,
        image_count=len(image_inputs),
        request_id=request.state.request_id,
        provider=provider_name,
        demo_mode=demo_mode,
    )
    return ApiResponse(success=True, data=analysis, error=None)
