from typing import Protocol

from app.schemas import LabelProviderResult, LabelTarget


class VisionProvider(Protocol):
    name: str
    demo_mode: bool

    async def analyze_label(
        self,
        image_bytes: bytes,
        mime_type: str,
        ocr_text: str | None,
        locale: str,
        requested_field: LabelTarget,
    ) -> LabelProviderResult: ...
