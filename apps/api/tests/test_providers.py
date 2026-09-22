import asyncio

import pytest
from pydantic import ValidationError

from app.errors import VisionProviderError
from app.providers.fallback import FallbackVisionProvider
from app.providers.openai import _extract_output_text
from app.schemas import LabelProviderResult
from tests.conftest import JPEG_BYTES


class FailingProvider:
    name = "failing"
    demo_mode = False

    async def analyze_label(self, image_bytes, mime_type, ocr_text, locale):
        raise VisionProviderError("offline")

    async def analyze_scene(self, image_bytes, mime_type, locale):
        raise VisionProviderError("offline")


class HangingProvider:
    name = "hanging"
    demo_mode = False

    async def analyze_label(self, image_bytes, mime_type, ocr_text, locale):
        await asyncio.sleep(1)

    async def analyze_scene(self, image_bytes, mime_type, locale):
        await asyncio.sleep(1)


@pytest.mark.asyncio
async def test_external_failure_uses_labeled_fixture_fallback() -> None:
    provider = FallbackVisionProvider(FailingProvider(), timeout_seconds=0.1)

    result = await provider.analyze_label(
        JPEG_BYTES, "image/jpeg", "PANADOL", "vi-VN"
    )

    assert provider.last_provider == "fixture-fallback"
    assert provider.last_demo_mode is True
    assert "dữ liệu mẫu" in result.warnings[0]


@pytest.mark.asyncio
async def test_external_timeout_uses_labeled_fixture_fallback() -> None:
    provider = FallbackVisionProvider(HangingProvider(), timeout_seconds=0.001)

    result = await provider.analyze_label(
        JPEG_BYTES, "image/jpeg", "DẦU GỘI", "vi-VN"
    )

    assert provider.last_provider == "fixture-fallback"
    assert provider.last_demo_mode is True
    assert result.product_name == "Dầu gội mẫu"


def test_extract_output_text() -> None:
    text = _extract_output_text(
        {
            "output": [
                {
                    "type": "message",
                    "content": [{"type": "output_text", "text": '{"ok":true}'}],
                }
            ]
        }
    )

    assert text == '{"ok":true}'


def test_expiry_date_rejects_impossible_month() -> None:
    with pytest.raises(ValidationError):
        LabelProviderResult(
            product_type="medicine",
            product_name="Sample",
            expiry_date="2027-13",
            visible_instructions=[],
            warnings=[],
            unreadable_fields=[],
            evidence_text=[],
            confidence="low",
            speech_text="Không rõ.",
        )
