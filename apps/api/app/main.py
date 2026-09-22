import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.errors import ApiError
from app.rate_limit import InMemoryRateLimitMiddleware
from app.routes import router
from app.schemas import ApiResponse, ErrorDetail


def _error_response(
    request: Request, *, status_code: int, code: str, message: str
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    payload = ApiResponse[None](
        success=False,
        data=None,
        error=ErrorDetail(code=code, message=message, request_id=request_id),
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump(mode="json"))


def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or get_settings()
    logging.basicConfig(
        level=getattr(logging, active_settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    app = FastAPI(
        title="Đôi Mắt AI API",
        version="0.1.0",
        description="Ephemeral image analysis API for the AI4Life hackathon MVP.",
    )
    app.dependency_overrides[get_settings] = lambda: active_settings

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = (
            getattr(request.state, "request_id", None)
            or request.headers.get("X-Request-ID")
            or str(uuid.uuid4())
        )
        request.state.request_id = request_id[:128]
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    app.add_middleware(
        InMemoryRateLimitMiddleware,
        requests=active_settings.rate_limit_requests,
        window_seconds=active_settings.rate_limit_window_seconds,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.allowed_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Request-ID"],
    )

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return _error_response(
            request,
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        return _error_response(
            request,
            status_code=422,
            code="invalid_request",
            message="Dữ liệu gửi lên không hợp lệ.",
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception):
        logging.getLogger(__name__).exception(
            "unhandled_error request_id=%s",
            getattr(request.state, "request_id", "unknown"),
        )
        return _error_response(
            request,
            status_code=500,
            code="internal_error",
            message="Hệ thống gặp lỗi. Vui lòng thử lại.",
        )

    app.include_router(router)
    logging.getLogger(__name__).info(
        "api_started provider=%s", active_settings.vision_provider
    )
    return app


app = create_app()
