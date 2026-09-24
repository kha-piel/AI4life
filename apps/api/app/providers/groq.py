import base64
import json
import logging
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.errors import VisionProviderError
from app.providers.base import VisionImage
from app.providers.prompts import LABEL_INSTRUCTIONS, build_label_prompt
from app.schemas import HealthCondition, LabelProviderResult, LabelTarget


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
        images: list[VisionImage],
        prompt: str,
        instructions: str,
        result_type: type[ResultT],
    ) -> ResultT:
        image_content = [
            {
                "type": "image_url",
                "image_url": {
                    "url": (
                        f"data:{mime_type};base64,"
                        f"{base64.b64encode(image_bytes).decode('ascii')}"
                    )
                },
            }
            for image_bytes, mime_type in images
        ]
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
                        *image_content,
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
            logger.warning(
                "groq_vision_invalid_structured_result model=%s error_type=%s",
                self.model,
                type(exc).__name__,
            )
            raise VisionProviderError("Groq returned an invalid structured result") from exc

    async def analyze_label(
        self,
        images: list[VisionImage],
        ocr_text: str | None,
        locale: str,
        requested_field: LabelTarget,
        health_condition: HealthCondition | None,
    ) -> LabelProviderResult:
        return await self._request(
            images=images,
            prompt=build_label_prompt(
                requested_field, locale, ocr_text, health_condition
            ),
            instructions=LABEL_INSTRUCTIONS,
            result_type=LabelProviderResult,
        )
