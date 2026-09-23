import base64
import json
import logging
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.errors import VisionProviderError
from app.providers.prompts import LABEL_INSTRUCTIONS, SCENE_INSTRUCTIONS
from app.schemas import LabelProviderResult, SceneProviderResult


ResultT = TypeVar("ResultT", bound=BaseModel)
logger = logging.getLogger(__name__)


def _extract_message_content(payload: dict[str, Any]) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise VisionProviderError("Groq response did not contain message content") from exc
    if not isinstance(content, str) or not content.strip():
        raise VisionProviderError("Groq response did not contain message content")
    return content


class GroqVisionProvider:
    name = "groq"
    demo_mode = False

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str,
        timeout_seconds: float,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    async def _request(
        self,
        *,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        instructions: str,
        result_type: type[ResultT],
    ) -> ResultT:
        encoded = base64.b64encode(image_bytes).decode("ascii")
        schema = json.dumps(result_type.model_json_schema(), ensure_ascii=False)
        system_prompt = (
            f"{instructions}\n\n"
            "Chỉ trả về đúng một JSON object, không Markdown và không giải thích. "
            f"JSON phải khớp schema này: {schema}"
        )
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{encoded}"
                            },
                        },
                    ],
                },
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_completion_tokens": 2048,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "groq_vision_http_error model=%s status_code=%s request_id=%s",
                self.model,
                exc.response.status_code,
                exc.response.headers.get("x-request-id", "unknown"),
            )
            raise VisionProviderError("Groq vision request failed") from exc
        except httpx.RequestError as exc:
            logger.warning(
                "groq_vision_transport_error model=%s error_type=%s",
                self.model,
                type(exc).__name__,
            )
            raise VisionProviderError("Groq vision request failed") from exc

        try:
            output_text = _extract_message_content(response.json())
            return result_type.model_validate_json(output_text)
        except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
            raise VisionProviderError("Groq returned an invalid structured result") from exc

    async def analyze_label(
        self,
        image_bytes: bytes,
        mime_type: str,
        ocr_text: str | None,
        locale: str,
    ) -> LabelProviderResult:
        evidence = ocr_text.strip()[:4000] if ocr_text else "(không có OCR text)"
        return await self._request(
            image_bytes=image_bytes,
            mime_type=mime_type,
            prompt=f"Phân tích nhãn. Locale: {locale}. OCR text:\n{evidence}",
            instructions=LABEL_INSTRUCTIONS,
            result_type=LabelProviderResult,
        )

    async def analyze_scene(
        self,
        image_bytes: bytes,
        mime_type: str,
        locale: str,
    ) -> SceneProviderResult:
        return await self._request(
            image_bytes=image_bytes,
            mime_type=mime_type,
            prompt=f"Phân tích nguy cơ trong cảnh. Locale: {locale}.",
            instructions=SCENE_INSTRUCTIONS,
            result_type=SceneProviderResult,
        )
