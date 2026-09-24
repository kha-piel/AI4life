from app.providers.prompts import build_label_prompt
from app.schemas import HealthCondition, LabelTarget


def test_diabetes_prompt_requires_label_evidence_and_blocks_medication_advice() -> None:
    prompt = build_label_prompt(
        LabelTarget.ALL,
        "vi-VN",
        None,
        HealthCondition.DIABETES,
    )

    assert "tổng carbohydrate" in prompt
    assert "không chỉ nhìn" in prompt
    assert "Không hướng dẫn liều insulin" in prompt


def test_prompt_disables_health_assessment_without_selected_condition() -> None:
    prompt = build_label_prompt(LabelTarget.ALL, "vi-VN", None)

    assert "Đặt health_assessment là null" in prompt
