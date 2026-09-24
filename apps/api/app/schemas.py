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


class HealthCondition(StrEnum):
    DIABETES = "diabetes"


class HealthVerdict(StrEnum):
    CONSIDER = "consider"
    LIMIT = "limit"
    AVOID = "avoid"
    UNCERTAIN = "uncertain"


class NutritionFacts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    serving_size: str | None
    total_carbohydrate_g: float | None = Field(ge=0)
    total_sugars_g: float | None = Field(ge=0)
    added_sugars_g: float | None = Field(ge=0)
    dietary_fiber_g: float | None = Field(ge=0)
    sodium_mg: float | None = Field(ge=0)


def empty_nutrition_facts() -> NutritionFacts:
    return NutritionFacts(
        serving_size=None,
        total_carbohydrate_g=None,
        total_sugars_g=None,
        added_sugars_g=None,
        dietary_fiber_g=None,
        sodium_mg=None,
    )


class IngredientAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ingredient: str = Field(min_length=1, max_length=100)
    verdict: HealthVerdict
    reason: str = Field(min_length=1, max_length=300)


class HealthAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    condition: HealthCondition
    verdict: HealthVerdict
    summary: str = Field(min_length=1, max_length=500)
    reasons: list[str] = Field(max_length=6)
    ingredient_assessments: list[IngredientAssessment] = Field(max_length=12)
    missing_information: list[str] = Field(max_length=6)


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
    nutrition_facts: NutritionFacts
    health_assessment: HealthAssessment | None
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
    image_count: int = Field(ge=1, le=3)
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
