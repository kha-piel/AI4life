import asyncio
import time
import uuid
from collections import defaultdict, deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.schemas import ApiResponse, ErrorDetail


class InMemoryRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, requests: int, window_seconds: int) -> None:
        super().__init__(app)
        self.requests = requests
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.url.path == "/health":
            return await call_next(request)

        client_key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        async with self._lock:
            events = self._events[client_key]
            while events and now - events[0] >= self.window_seconds:
                events.popleft()
            if len(events) >= self.requests:
                request_id = (
                    getattr(request.state, "request_id", None)
                    or request.headers.get("X-Request-ID")
                    or str(uuid.uuid4())
                )[:128]
                request.state.request_id = request_id
                payload = ApiResponse[None](
                    success=False,
                    data=None,
                    error=ErrorDetail(
                        code="rate_limit_exceeded",
                        message="Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                        request_id=request_id,
                    ),
                )
                return Response(
                    content=payload.model_dump_json(),
                    status_code=429,
                    media_type="application/json",
                    headers={
                        "Retry-After": str(self.window_seconds),
                        "X-Request-ID": request_id,
                    },
                )
            events.append(now)

        return await call_next(request)
