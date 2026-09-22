from typing import Protocol

from app.schemas import LabelProviderResult, SceneProviderResult


class VisionProvider(Protocol):
    name: str
    demo_mode: bool

    async def analyze_label(
        self,
        image_bytes: bytes,
        mime_type: str,
        ocr_text: str | None,
        locale: str,
    ) -> LabelProviderResult: ...

    async def analyze_scene(
        self,
        image_bytes: bytes,
        mime_type: str,
        locale: str,
    ) -> SceneProviderResult: ...

