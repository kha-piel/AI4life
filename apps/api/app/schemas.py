from enum import StrEnum
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Confidence(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class LabelProviderResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_type: str | None
    product_name: str | None
    expiry_date: str | None
    visible_instructions: list[str] = Field(max_length=8)
    warnings: list[str] = Field(max_length=8)
    unreadable_fields: list[str] = Field(max_length=8)
    evidence_text: list[str] = Field(max_length=12)
    confidence: Confidence
    speech_text: str = Field(min_length=1, max_length=800)

    @field_validator("expiry_date")
    @classmethod
    def validate_expiry_date(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if len(value) != 7 or value[4] != "-":
            raise ValueError("expiry_date must use YYYY-MM")
        year, month = value.split("-")
        if not year.isdigit() or not month.isdigit() or not 1 <= int(month) <= 12:
            raise ValueError("expiry_date must use a valid YYYY-MM")
        return value


class LabelAnalysis(LabelProviderResult):
    request_id: str
    provider: str
    demo_mode: bool


class SceneHazard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["obstacle", "person", "stairs", "wet_floor", "blocked_path"]
    direction: Literal["left", "center", "right", "unknown"]
    urgency: Literal["info", "warning", "urgent"]
    confidence: Confidence
    speech_text: str = Field(min_length=1, max_length=240)


class SceneProviderResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hazards: list[SceneHazard] = Field(max_length=3)
    limitations: list[str] = Field(max_length=5)


class SceneAnalysis(SceneProviderResult):
    request_id: str
    provider: str
    demo_mode: bool


class HealthData(BaseModel):
    status: Literal["ok"] = "ok"
    provider: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str


DataT = TypeVar("DataT")


class ApiResponse(BaseModel, Generic[DataT]):
    success: bool
    data: DataT | None
    error: ErrorDetail | None

