import hashlib
import hmac
from typing import Annotated

from fastapi import Depends, Header

from app.config import Settings, get_settings
from app.errors import ApiError, AppConfigurationError


def hash_access_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def validate_access_settings(settings: Settings) -> None:
    if settings.require_app_auth and not settings.app_access_token_hash_set:
        raise AppConfigurationError(
            "APP_ACCESS_TOKEN_HASHES is required when REQUIRE_APP_AUTH=true"
        )


def is_valid_access_token(token: str, settings: Settings) -> bool:
    candidate = hash_access_token(token)
    return any(
        hmac.compare_digest(candidate, allowed)
        for allowed in settings.app_access_token_hash_set
    )


async def require_app_access(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    if not settings.require_app_auth:
        return

    try:
        validate_access_settings(settings)
    except AppConfigurationError as exc:
        raise ApiError(
            503,
            "app_auth_not_configured",
            "Máy chủ chưa cấu hình quyền truy cập ứng dụng.",
        ) from exc

    scheme, _, token = (authorization or "").partition(" ")
    if scheme.casefold() != "bearer" or not token or not is_valid_access_token(
        token, settings
    ):
        raise ApiError(
            401,
            "access_denied",
            "Mã truy cập không hợp lệ hoặc đã bị thu hồi.",
        )
