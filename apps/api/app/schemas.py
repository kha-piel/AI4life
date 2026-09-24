from datetime import date
from enum import StrEnum
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Confidence(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class LabelTarget(StrEnum):
    EXPIRY_DATE = "expiry_date"
    PRODUCT_NAME = "product_name"
    INGREDIENTS = "ingredients"
    USAGE_INSTRUCTIONS = "usage_instructions"
    ALL = "all"


class LabelProviderResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_type: str | None
    product_name: str | None
    expiry_date: str | None
    ingredients: list[str] = Field(max_length=20)
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
        if len(value) == 7 and value[4] == "-":
            year, month = value.split("-")
            if year.isdigit() and month.isdigit():
                try:
                    date(int(year), int(month), 1)
                    return value
                except ValueError:
                    pass
        if len(value) == 10:
            try:
                date.fromisoformat(value)
                return value
            except ValueError:
                pass
        raise ValueError("expiry_date must use a valid YYYY-MM or YYYY-MM-DD")


class LabelAnalysis(LabelProviderResult):
    requested_field: LabelTarget
    request_id: str
    provider: str
    demo_mode: bool


class HealthData(BaseModel):
    status: Literal["ok"] = "ok"
    provider: str


class AccessData(BaseModel):
    status: Literal["authorized"] = "authorized"


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str


DataT = TypeVar("DataT")


class ApiResponse(BaseModel, Generic[DataT]):
    success: bool
    data: DataT | None
    error: ErrorDetail | None
