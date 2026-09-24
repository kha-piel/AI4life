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


def _extract_output_text(payload: dict[str, Any]) -> str:
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                return content["text"]
    raise VisionProviderError("OpenAI response did not contain output text")


class OpenAIVisionProvider:
    name = "openai"
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
        schema_name: str,
    ) -> ResultT:
        image_content = [
            {
                "type": "input_image",
                "image_url": (
                    f"data:{mime_type};base64,"
                    f"{base64.b64encode(image_bytes).decode('ascii')}"
                ),
                "detail": "high",
            }
            for image_bytes, mime_type in images
        ]
        body = {
            "model": self.model,
            "store": False,
            "instructions": instructions,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        *image_content,
                    ],
                }
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": True,
                    "schema": result_type.model_json_schema(),
                }
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/responses",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "openai_vision_http_error model=%s status_code=%s request_id=%s",
                self.model,
                exc.response.status_code,
                exc.response.headers.get("x-request-id", "unknown"),
            )
            raise VisionProviderError("OpenAI vision request failed") from exc
        except httpx.RequestError as exc:
            logger.warning(
                "openai_vision_transport_error model=%s error_type=%s",
                self.model,
                type(exc).__name__,
            )
            raise VisionProviderError("OpenAI vision request failed") from exc

        try:
            output_text = _extract_output_text(response.json())
            return result_type.model_validate_json(output_text)
        except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
            logger.warning(
                "openai_vision_invalid_structured_result model=%s error_type=%s",
                self.model,
                type(exc).__name__,
            )
            raise VisionProviderError("OpenAI returned an invalid structured result") from exc

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
            schema_name="label_analysis",
        )
