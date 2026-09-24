import asyncio
import logging

from app.errors import VisionProviderError
from app.providers.base import VisionImage, VisionProvider
from app.providers.fixture import FixtureVisionProvider
from app.schemas import HealthCondition, LabelProviderResult, LabelTarget


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
        images: list[VisionImage],
        ocr_text: str | None,
        locale: str,
        requested_field: LabelTarget,
        health_condition: HealthCondition | None,
    ) -> LabelProviderResult:
        try:
            result = await asyncio.wait_for(
                self.primary.analyze_label(
                    images, ocr_text, locale, requested_field, health_condition
                ),
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
                images, ocr_text, locale, requested_field, health_condition
            )
            result.warnings.insert(
                0, "Dịch vụ AI bên ngoài lỗi; đây là kết quả dữ liệu mẫu"
            )
            return result
