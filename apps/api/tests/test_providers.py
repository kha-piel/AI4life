import asyncio
import base64
import json

import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings
from app.errors import VisionProviderError
from app.providers.fallback import FallbackVisionProvider
from app.providers.factory import build_provider
from app.providers.groq import GroqVisionProvider, _extract_message_content
from app.providers.openai import OpenAIVisionProvider, _extract_output_text
from app.schemas import LabelProviderResult, LabelTarget, empty_nutrition_facts
from tests.conftest import JPEG_BYTES


class FailingProvider:
    name = "failing"
    demo_mode = False

    async def analyze_label(
        self, images, ocr_text, locale, requested_field, health_condition
    ):
        raise VisionProviderError("offline")


class HangingProvider:
    name = "hanging"
    demo_mode = False

    async def analyze_label(
        self, images, ocr_text, locale, requested_field, health_condition
    ):
        await asyncio.sleep(1)


def test_real_mode_builds_openai_without_fixture_fallback() -> None:
    provider = build_provider(
        Settings(
            vision_provider="openai",
            allow_fixture_fallback=False,
            openai_api_key="unit-test-placeholder",
        )
    )

    assert type(provider) is OpenAIVisionProvider
    assert provider.demo_mode is False


def test_real_mode_builds_groq_without_fixture_fallback() -> None:
    provider = build_provider(
        Settings(
            vision_provider="groq",
            allow_fixture_fallback=False,
            groq_api_key="unit-test-placeholder",
        )
    )

    assert type(provider) is GroqVisionProvider
    assert provider.demo_mode is False


@pytest.mark.asyncio
async def test_external_failure_uses_labeled_fixture_fallback() -> None:
    provider = FallbackVisionProvider(FailingProvider(), timeout_seconds=0.1)

    result = await provider.analyze_label(
        [(JPEG_BYTES, "image/jpeg")], "PANADOL", "vi-VN", LabelTarget.ALL, None
    )

    assert provider.last_provider == "fixture-fallback"
    assert provider.last_demo_mode is True
    assert "dữ liệu mẫu" in result.warnings[0]


@pytest.mark.asyncio
async def test_external_timeout_uses_labeled_fixture_fallback() -> None:
    provider = FallbackVisionProvider(HangingProvider(), timeout_seconds=0.001)

    result = await provider.analyze_label(
        [(JPEG_BYTES, "image/jpeg")], "DẦU GỘI", "vi-VN", LabelTarget.ALL, None
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


def test_extract_groq_message_content() -> None:
    text = _extract_message_content(
        {"choices": [{"message": {"content": '{"ok":true}'}}]}
    )

    assert text == '{"ok":true}'


@pytest.mark.asyncio
async def test_groq_provider_sends_exact_image_in_json_mode(monkeypatch) -> None:
    captured: dict = {}
    model_result = {
        "product_type": "food",
        "product_name": "Nhãn từ ảnh camera",
        "expiry_date": None,
        "ingredients": [],
        "visible_instructions": [],
        "warnings": [],
        "unreadable_fields": ["expiry_date"],
        "evidence_text": ["CAMERA LABEL"],
        "nutrition_facts": empty_nutrition_facts().model_dump(),
        "health_assessment": None,
        "confidence": "medium",
        "speech_text": "Tôi đọc được nhãn từ ảnh camera.",
    }

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured["timeout"] = kwargs["timeout"]

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return False

        async def post(self, url, *, headers, json):
            captured.update(url=url, headers=headers, body=json)
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={
                    "choices": [
                        {
                            "message": {
                                "content": json_module.dumps(
                                    model_result, ensure_ascii=False
                                )
                            }
                        }
                    ]
                },
            )

    json_module = json
    monkeypatch.setattr("app.providers.groq.httpx.AsyncClient", FakeAsyncClient)
    provider = GroqVisionProvider(
        api_key="unit-test-placeholder",
        model="qwen/qwen3.8-27b",
        base_url="https://api.groq.com/openai/v1",
        timeout_seconds=30,
    )

    second_image = JPEG_BYTES + b"second"
    result = await provider.analyze_label(
        [(JPEG_BYTES, "image/jpeg"), (second_image, "image/jpeg")],
        None,
        "vi-VN",
        LabelTarget.EXPIRY_DATE,
        None,
    )

    body = captured["body"]
    image_url = body["messages"][1]["content"][1]["image_url"]["url"]
    assert captured["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert body["response_format"] == {"type": "json_object"}
    assert "JSON phải khớp schema này" in body["messages"][0]["content"]
    assert "expiry_date" in body["messages"][1]["content"][0]["text"]
    assert base64.b64decode(image_url.split(",", 1)[1]) == JPEG_BYTES
    second_image_url = body["messages"][1]["content"][2]["image_url"]["url"]
    assert base64.b64decode(second_image_url.split(",", 1)[1]) == second_image
    assert result.product_name == "Nhãn từ ảnh camera"


@pytest.mark.asyncio
async def test_openai_provider_sends_exact_image_without_storage(monkeypatch) -> None:
    captured: dict = {}
    model_result = {
        "product_type": "food",
        "product_name": "Nhãn từ ảnh camera",
        "expiry_date": None,
        "ingredients": [],
        "visible_instructions": [],
        "warnings": [],
        "unreadable_fields": ["expiry_date"],
        "evidence_text": ["CAMERA LABEL"],
        "nutrition_facts": empty_nutrition_facts().model_dump(),
        "health_assessment": None,
        "confidence": "medium",
        "speech_text": "Tôi đọc được nhãn từ ảnh camera.",
    }

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured["timeout"] = kwargs["timeout"]

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return False

        async def post(self, url, *, headers, json):
            captured.update(url=url, headers=headers, body=json)
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={
                    "output": [
                        {
                            "type": "message",
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": json_module.dumps(
                                        model_result, ensure_ascii=False
                                    ),
                                }
                            ],
                        }
                    ]
                },
            )

    json_module = json
    monkeypatch.setattr("app.providers.openai.httpx.AsyncClient", FakeAsyncClient)
    provider = OpenAIVisionProvider(
        api_key="unit-test-placeholder",
        model="gpt-6-astra",
        base_url="https://api.openai.com/v1",
        timeout_seconds=30,
    )

    second_image = JPEG_BYTES + b"second"
    result = await provider.analyze_label(
        [(JPEG_BYTES, "image/jpeg"), (second_image, "image/jpeg")],
        None,
        "vi-VN",
        LabelTarget.PRODUCT_NAME,
        None,
    )

    image_url = captured["body"]["input"][0]["content"][1]["image_url"]
    assert captured["body"]["store"] is False
    assert captured["body"]["text"]["format"]["strict"] is True
    assert base64.b64decode(image_url.split(",", 1)[1]) == JPEG_BYTES
    second_image_url = captured["body"]["input"][0]["content"][2]["image_url"]
    assert base64.b64decode(second_image_url.split(",", 1)[1]) == second_image
    assert result.product_name == "Nhãn từ ảnh camera"


def test_expiry_date_rejects_impossible_month() -> None:
    with pytest.raises(ValidationError):
        LabelProviderResult(
            product_type="medicine",
            product_name="Sample",
            expiry_date="2027-13",
            ingredients=[],
            visible_instructions=[],
            warnings=[],
            unreadable_fields=[],
            evidence_text=[],
            nutrition_facts=empty_nutrition_facts(),
            health_assessment=None,
            confidence="low",
            speech_text="Không rõ.",
        )


def test_expiry_date_accepts_real_full_date() -> None:
    result = LabelProviderResult(
        product_type="food",
        product_name="Sample",
        expiry_date="2027-10-15",
        ingredients=[],
        visible_instructions=[],
        warnings=[],
        unreadable_fields=[],
        evidence_text=["EXP 15/10/2027"],
        nutrition_facts=empty_nutrition_facts(),
        health_assessment=None,
        confidence="high",
        speech_text="Hạn sử dụng ngày 15 tháng 10 năm 2027.",
    )

    assert result.expiry_date == "2027-10-15"


def test_expiry_date_rejects_impossible_full_date() -> None:
    with pytest.raises(ValidationError):
        LabelProviderResult(
            product_type="food",
            product_name="Sample",
            expiry_date="2027-02-30",
            ingredients=[],
            visible_instructions=[],
            warnings=[],
            unreadable_fields=[],
            evidence_text=[],
            nutrition_facts=empty_nutrition_facts(),
            health_assessment=None,
            confidence="low",
            speech_text="Không rõ.",
        )
