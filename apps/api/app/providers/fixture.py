from app.schemas import (
    Confidence,
    LabelProviderResult,
    LabelTarget,
)


class FixtureVisionProvider:
    name = "fixture"
    demo_mode = True

    async def analyze_label(
        self,
        image_bytes: bytes,
        mime_type: str,
        ocr_text: str | None,
        locale: str,
        requested_field: LabelTarget,
    ) -> LabelProviderResult:
        normalized = (ocr_text or "").casefold()
        if "dầu gội" in normalized or "dau goi" in normalized or "shampoo" in normalized:
            result = LabelProviderResult(
                product_type="personal_care",
                product_name="Dầu gội mẫu",
                expiry_date=None,
                ingredients=[],
                visible_instructions=["Tránh tiếp xúc với mắt"],
                warnings=[],
                unreadable_fields=["hạn sử dụng"],
                evidence_text=["DẦU GỘI", "Tránh tiếp xúc với mắt"],
                confidence=Confidence.MEDIUM,
                speech_text=(
                    "Chế độ dữ liệu mẫu. Đây là dầu gội. "
                    "Trên nhãn ghi: tránh tiếp xúc với mắt. "
                    "Tôi chưa đọc rõ hạn sử dụng."
                ),
            )
        else:
            ingredients = (
                ["Paracetamol", "Caffeine"]
                if "paracetamol" in normalized or "caffeine" in normalized
                else []
            )
            result = LabelProviderResult(
                product_type="medicine",
                product_name="Panadol Extra mẫu",
                expiry_date="2027-10",
                ingredients=ingredients,
                visible_instructions=["Uống sau khi ăn"],
                warnings=["Không dùng thông tin mẫu để quyết định dùng thuốc"],
                unreadable_fields=[] if ingredients else ["thành phần"],
                evidence_text=[
                    "PANADOL EXTRA",
                    "EXP 10/2027",
                    *(ingredients or []),
                    "Uống sau khi ăn",
                ],
                confidence=Confidence.HIGH,
                speech_text=(
                    "Chế độ dữ liệu mẫu. Đây có thể là Panadol Extra. "
                    "Hạn sử dụng tháng 10 năm 2027. "
                    "Trên nhãn ghi: uống sau khi ăn."
                ),
            )

        if requested_field == LabelTarget.ALL:
            return result
        if requested_field == LabelTarget.EXPIRY_DATE:
            return result.model_copy(
                update={
                    "product_type": None,
                    "product_name": None,
                    "ingredients": [],
                    "visible_instructions": [],
                    "warnings": [],
                    "unreadable_fields": [] if result.expiry_date else ["hạn sử dụng"],
                    "speech_text": (
                        "Hạn sử dụng tháng 10 năm 2027."
                        if result.expiry_date
                        else "Tôi chưa đọc rõ hạn sử dụng. Hãy chụp gần phần có chữ HSD hoặc EXP."
                    ),
                }
            )
        if requested_field == LabelTarget.PRODUCT_NAME:
            return result.model_copy(
                update={
                    "product_type": None,
                    "expiry_date": None,
                    "ingredients": [],
                    "visible_instructions": [],
                    "warnings": [],
                    "unreadable_fields": [] if result.product_name else ["tên sản phẩm"],
                    "speech_text": (
                        f"Tên sản phẩm: {result.product_name}."
                        if result.product_name
                        else "Tôi chưa đọc rõ tên sản phẩm."
                    ),
                }
            )
        if requested_field == LabelTarget.INGREDIENTS:
            return result.model_copy(
                update={
                    "product_type": None,
                    "product_name": None,
                    "expiry_date": None,
                    "visible_instructions": [],
                    "warnings": [],
                    "unreadable_fields": [] if result.ingredients else ["thành phần"],
                    "speech_text": (
                        "Thành phần đọc được: " + ", ".join(result.ingredients) + "."
                        if result.ingredients
                        else "Tôi chưa đọc rõ thành phần. Hãy chụp gần mục Thành phần."
                    ),
                }
            )
        return result.model_copy(
            update={
                "product_type": None,
                "product_name": None,
                "expiry_date": None,
                "ingredients": [],
                "warnings": [],
                "unreadable_fields": (
                    [] if result.visible_instructions else ["hướng dẫn sử dụng"]
                ),
                "speech_text": (
                    "Hướng dẫn trên nhãn: " + ". ".join(result.visible_instructions) + "."
                    if result.visible_instructions
                    else "Tôi chưa đọc rõ hướng dẫn sử dụng."
                ),
            }
        )
