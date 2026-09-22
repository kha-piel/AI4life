from app.errors import ApiError


ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def detected_image_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_image(data: bytes, declared_type: str | None, max_bytes: int) -> str:
    if not data:
        raise ApiError(400, "empty_image", "Ảnh tải lên đang trống.")
    if len(data) > max_bytes:
        raise ApiError(413, "image_too_large", "Ảnh vượt quá dung lượng cho phép.")
    if declared_type not in ALLOWED_TYPES:
        raise ApiError(415, "unsupported_image_type", "Chỉ hỗ trợ JPEG, PNG hoặc WEBP.")

    detected_type = detected_image_type(data)
    if detected_type is None or detected_type != declared_type:
        raise ApiError(
            415,
            "invalid_image_signature",
            "Nội dung ảnh không khớp với định dạng đã khai báo.",
        )
    return detected_type

