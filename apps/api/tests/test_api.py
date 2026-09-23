import asyncio
import hashlib

from fastapi.testclient import TestClient

from app.config import Settings
from app.dependencies import get_provider
from app.main import create_app
from app.schemas import (
    Confidence,
    LabelProviderResult,
    SceneProviderResult,
)
from tests.conftest import JPEG_BYTES


def test_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "data": {"status": "ok", "provider": "fixture"},
        "error": None,
    }


def test_health_rejects_unconfigured_real_provider() -> None:
    settings = Settings(
        vision_provider="openai",
        allow_fixture_fallback=False,
        openai_api_key=None,
        rate_limit_requests=100,
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "provider_not_configured"


def test_health_rejects_unconfigured_groq_provider() -> None:
    settings = Settings(
        vision_provider="groq",
        allow_fixture_fallback=False,
        groq_api_key=None,
        rate_limit_requests=100,
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "provider_not_configured"


def test_health_rejects_missing_public_access_configuration() -> None:
    settings = Settings(
        vision_provider="fixture",
        require_app_auth=True,
        app_access_token_hashes="",
        rate_limit_requests=100,
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "app_auth_not_configured"


def test_access_check_accepts_only_a_configured_invitation_code() -> None:
    access_code = "friend-specific-test-token"
    access_hash = hashlib.sha256(access_code.encode("utf-8")).hexdigest()
    settings = Settings(
        vision_provider="fixture",
        require_app_auth=True,
        app_access_token_hashes=access_hash,
        rate_limit_requests=100,
    )
    with TestClient(create_app(settings)) as client:
        missing = client.get("/v1/access-check")
        invalid = client.get(
            "/v1/access-check",
            headers={"Authorization": "Bearer wrong-token"},
        )
        valid = client.get(
            "/v1/access-check",
            headers={"Authorization": f"Bearer {access_code}"},
        )

    assert missing.status_code == 401
    assert invalid.status_code == 401
    assert valid.status_code == 200
    assert valid.json()["data"] == {"status": "authorized"}


def test_analysis_requires_access_code_on_public_deployment() -> None:
    access_code = "friend-specific-test-token"
    access_hash = hashlib.sha256(access_code.encode("utf-8")).hexdigest()
    settings = Settings(
        vision_provider="fixture",
        require_app_auth=True,
        app_access_token_hashes=access_hash,
        rate_limit_requests=100,
    )
    with TestClient(create_app(settings)) as client:
        denied = client.post(
            "/v1/analyze-label",
            files={"image": ("label.jpg", JPEG_BYTES, "image/jpeg")},
        )
        allowed = client.post(
            "/v1/analyze-label",
            files={"image": ("label.jpg", JPEG_BYTES, "image/jpeg")},
            headers={"Authorization": f"Bearer {access_code}"},
        )

    assert denied.status_code == 401
    assert denied.json()["error"]["code"] == "access_denied"
    assert allowed.status_code == 200


def test_analyze_label_returns_explicit_fixture_result(client: TestClient) -> None:
    response = client.post(
        "/v1/analyze-label",
        files={"image": ("label.jpg", JPEG_BYTES, "image/jpeg")},
        data={"ocr_text": "PANADOL EXTRA EXP 10/2027"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["demo_mode"] is True
    assert payload["data"]["provider"] == "fixture"
    assert payload["data"]["expiry_date"] == "2027-10"
    assert payload["data"]["request_id"]
    assert response.headers["x-request-id"] == payload["data"]["request_id"]


def test_analyze_scene_limits_hazards(client: TestClient) -> None:
    response = client.post(
        "/v1/analyze-scene",
        files={"image": ("room.jpg", JPEG_BYTES, "image/jpeg")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["data"]["hazards"]) <= 3
    assert payload["data"]["hazards"][0]["type"] == "obstacle"


def test_rejects_spoofed_image_content(client: TestClient) -> None:
    response = client.post(
        "/v1/analyze-label",
        files={"image": ("fake.jpg", b"not-a-jpeg", "image/jpeg")},
    )

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "invalid_image_signature"


def test_rejects_unsupported_image_type(client: TestClient) -> None:
    response = client.post(
        "/v1/analyze-label",
        files={"image": ("image.gif", b"GIF89a", "image/gif")},
    )

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_image_type"


def test_rejects_oversized_image() -> None:
    settings = Settings(
        vision_provider="fixture",
        max_upload_bytes=8,
        rate_limit_requests=100,
    )
    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/v1/analyze-label",
            files={"image": ("large.jpg", JPEG_BYTES, "image/jpeg")},
        )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "image_too_large"


class SlowProvider:
    name = "slow"
    demo_mode = False

    async def analyze_label(self, image_bytes, mime_type, ocr_text, locale):
        await asyncio.sleep(0.1)
        return LabelProviderResult(
            product_type=None,
            product_name=None,
            expiry_date=None,
            visible_instructions=[],
            warnings=[],
            unreadable_fields=[],
            evidence_text=[],
            confidence=Confidence.LOW,
            speech_text="Không rõ.",
        )

    async def analyze_scene(self, image_bytes, mime_type, locale):
        await asyncio.sleep(0.1)
        return SceneProviderResult(hazards=[], limitations=[])


def test_provider_timeout_is_controlled() -> None:
    settings = Settings(
        vision_provider="fixture",
        provider_timeout_seconds=0.001,
        rate_limit_requests=100,
    )
    app = create_app(settings)
    app.dependency_overrides[get_provider] = SlowProvider

    with TestClient(app) as client:
        response = client.post(
            "/v1/analyze-label",
            files={"image": ("label.jpg", JPEG_BYTES, "image/jpeg")},
        )

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "provider_timeout"


def test_rate_limit_has_consistent_error_envelope() -> None:
    settings = Settings(
        vision_provider="fixture",
        rate_limit_requests=1,
        rate_limit_window_seconds=60,
    )
    with TestClient(create_app(settings)) as client:
        first = client.post(
            "/v1/analyze-scene",
            files={"image": ("room.jpg", JPEG_BYTES, "image/jpeg")},
        )
        second = client.post(
            "/v1/analyze-scene",
            files={"image": ("room.jpg", JPEG_BYTES, "image/jpeg")},
        )

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "rate_limit_exceeded"
    assert second.json()["error"]["request_id"] == second.headers["x-request-id"]
