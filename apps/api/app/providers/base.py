from typing import Protocol

from app.schemas import LabelProviderResult, LabelTarget

VisionImage = tuple[bytes, str]


class VisionProvider(Protocol):
    name: str
    demo_mode: bool

    async def analyze_label(
        self,
        images: list[VisionImage],
        ocr_text: str | None,
        locale: str,
        requested_field: LabelTarget,
    ) -> LabelProviderResult: ...
