import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


JPEG_BYTES = b"\xff\xd8\xff\xe0fixture-image"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        vision_provider="fixture",
        rate_limit_requests=100,
        provider_timeout_seconds=0.2,
    )


@pytest.fixture
def client(settings: Settings):
    with TestClient(create_app(settings)) as test_client:
        yield test_client

