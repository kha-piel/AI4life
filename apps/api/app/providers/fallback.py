import asyncio
import logging

from app.errors import VisionProviderError
from app.providers.base import VisionProvider
from app.providers.fixture import FixtureVisionProvider
from app.schemas import LabelProviderResult, SceneProviderResult


logger = logging.getLogger(__name__)


class FallbackVisionProvider:
    demo_mode = True

    def __init__(self, primary: VisionProvider, timeout_seconds: float) -> None:
        self.primary = primary
        self.fallback = FixtureVisionProvider()
        self.name = f"{primary.name}+fixture-fallback"
        self.timeout_seconds = timeout_seconds
        self.last_provider = primary.name
        self.last_demo_mode = False

    async def analyze_label(
        self,
        image_bytes: bytes,
        mime_type: str,
        ocr_text: str | None,
        locale: str,
    ) -> LabelProviderResult:
        try:
            result = await asyncio.wait_for(
                self.primary.analyze_label(image_bytes, mime_type, ocr_text, locale),
                timeout=self.timeout_seconds,
            )
            self.last_provider = self.primary.name
            self.last_demo_mode = False
            return result
        except (TimeoutError, VisionProviderError):
            logger.warning("Primary label provider failed; using explicit fixture fallback")
            self.last_provider = "fixture-fallback"
            self.last_demo_mode = True
            result = await self.fallback.analyze_label(
                image_bytes, mime_type, ocr_text, locale
            )
            result.warnings.insert(
                0, "Dịch vụ AI bên ngoài lỗi; đây là kết quả dữ liệu mẫu"
            )
            return result

    async def analyze_scene(
        self,
        image_bytes: bytes,
        mime_type: str,
        locale: str,
    ) -> SceneProviderResult:
        try:
            result = await asyncio.wait_for(
                self.primary.analyze_scene(image_bytes, mime_type, locale),
                timeout=self.timeout_seconds,
            )
            self.last_provider = self.primary.name
            self.last_demo_mode = False
            return result
        except (TimeoutError, VisionProviderError):
            logger.warning("Primary scene provider failed; using explicit fixture fallback")
            self.last_provider = "fixture-fallback"
            self.last_demo_mode = True
            return await self.fallback.analyze_scene(image_bytes, mime_type, locale)
