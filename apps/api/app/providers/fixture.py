from app.schemas import (
    Confidence,
    LabelProviderResult,
    SceneHazard,
    SceneProviderResult,
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
    ) -> LabelProviderResult:
        normalized = (ocr_text or "").casefold()
        if "dầu gội" in normalized or "dau goi" in normalized or "shampoo" in normalized:
            return LabelProviderResult(
                product_type="personal_care",
                product_name="Dầu gội mẫu",
                expiry_date=None,
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

        return LabelProviderResult(
            product_type="medicine",
            product_name="Panadol Extra mẫu",
            expiry_date="2027-10",
            visible_instructions=["Uống sau khi ăn"],
            warnings=["Không dùng thông tin mẫu để quyết định dùng thuốc"],
            unreadable_fields=[],
            evidence_text=["PANADOL EXTRA", "EXP 10/2027", "Uống sau khi ăn"],
            confidence=Confidence.HIGH,
            speech_text=(
                "Chế độ dữ liệu mẫu. Đây có thể là Panadol Extra. "
                "Hạn sử dụng tháng 10 năm 2027. "
                "Trên nhãn ghi: uống sau khi ăn."
            ),
        )

    async def analyze_scene(
        self,
        image_bytes: bytes,
        mime_type: str,
        locale: str,
    ) -> SceneProviderResult:
        return SceneProviderResult(
            hazards=[
                SceneHazard(
                    type="obstacle",
                    direction="center",
                    urgency="warning",
                    confidence=Confidence.MEDIUM,
                    speech_text="Chế độ dữ liệu mẫu. Có vật cản ở phía trước.",
                )
            ],
            limitations=[
                "Không đo được khoảng cách chính xác từ ảnh này.",
                "Đây không phải hệ thống dẫn đường thời gian thực.",
            ],
        )

