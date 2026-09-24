# Kịch bản demo AIVision

## 1. Giả thuyết demo

Một người dùng mới có thể chọn phân tích tiểu đường, chụp đủ các mặt nhãn và nghe
kết luận thận trọng có bằng chứng trong dưới 90 giây.

## 2. Chuẩn bị

### Thiết bị

- Điện thoại Android đã cài APK mới và bật TalkBack.
- Pin trên 50%, âm lượng đủ lớn, quyền camera đã cấp.
- Mạng chính và hotspot dự phòng.
- Mở `/health` trước demo nếu dùng Render Free.

### Vật mẫu

- Một thực phẩm có mặt trước, thành phần và bảng dinh dưỡng nhìn rõ.
- Một nhãn ghi rõ khẩu phần, tổng carbohydrate, đường bổ sung và chất xơ.
- Một nhãn không chụp bảng dinh dưỡng để chứng minh hệ thống từ chối kết luận.

## 3. Demo chính — 90 giây

### Cảnh 1: Nỗi đau — 10 giây

“Người thị lực kém không chỉ cần đọc nhãn mà còn cần hiểu thành phần nào đáng lưu
ý với bệnh nền. AIVision đọc toàn bộ nhãn và giải thích dựa trên bằng chứng.”

### Cảnh 2: Đọc và phân tích cho người tiểu đường — 45 giây

1. TalkBack đọc màn hình “Đọc và phân tích nhãn”.
2. Chọn “Tiểu đường”.
3. Chụp mặt trước, thành phần và bảng dinh dưỡng của cùng sản phẩm.
4. Kiểm tra “Đã chọn 3/3 ảnh”, rồi nhấn “Phân tích 3 ảnh”.
5. App đọc thông tin nhãn, verdict và lý do có con số trên nhãn.
6. Chỉ ra phần “Phân tích cho người tiểu đường” và disclaimer.

### Cảnh 3: Guardrail thiếu dữ liệu — 25 giây

Chỉ chụp mặt trước hoặc che tổng carbohydrate. App phải trả “Chưa đủ dữ liệu” và
yêu cầu chụp khẩu phần/tổng carbohydrate, không tự nói sản phẩm an toàn.

## 4. Demo fallback

| Sự cố | Xử lý |
|---|---|
| Render đang ngủ | Mở `/health`, chờ `status=ok`, thử lại |
| Provider lỗi | Hiển thị failure state hoặc video quay trước; không giả là live |
| Camera chưa sẵn sàng | Chờ hướng dẫn đổi từ “Đang khởi động camera” rồi mới chụp |
| Camera không focus | Chụp gần hơn, đủ sáng, giữ yên hoặc dùng vật mẫu chữ lớn |
| Không cấp quyền camera | Dùng nút “Chọn ảnh từ thư viện” |
| TTS không phát | Dùng chữ lớn và TalkBack |

## 5. Bộ test tối thiểu trước demo

- 5 bộ ảnh đủ mặt trước, thành phần và bảng dinh dưỡng.
- 3 bộ thiếu khẩu phần hoặc tổng carbohydrate để kiểm tra abstention.
- Nhãn có chữ “không đường” nhưng vẫn có tổng carbohydrate.
- Nhãn có đường bổ sung và nhãn có chất xơ.
- Ảnh thẳng, nghiêng, tối, lóa và mờ.
- Chụp liên tục 10 lần để kiểm tra camera lifecycle.
- Trộn một ảnh camera và hai ảnh thư viện; kiểm tra ảnh thứ tư bị chặn.
- Render cold-start, mất mạng và provider timeout.
- TalkBack focus, label, role, state và vùng chạm.

## 6. Câu hỏi BGK dự kiến

### “Tại sao bỏ các nút đọc riêng?”

Các mục riêng trùng với “Đọc tất cả”. Một hành trình duy nhất giảm thao tác, trong
khi kết quả vẫn chia rõ tên, hạn sử dụng, thành phần, hướng dẫn và sức khỏe.

### “Tại sao cần AI?”

Nhãn có bố cục, góc chụp và định dạng đa dạng. Model vision thực hiện OCR và ghép
ngữ cảnh; schema, target prompt và validation deterministic giới hạn đầu ra.

### “Nếu AI đọc sai thuốc thì sao?”

Ứng dụng chỉ đọc nội dung có bằng chứng, từ chối khi không rõ và không hướng dẫn
insulin/thuốc. Với tiểu đường, code bắt buộc phải thấy khẩu phần và tổng carbohydrate
trước khi cho kết luận khác “chưa đủ dữ liệu”.

### “Có hoạt động offline không?”

TTS có thể chạy cục bộ; OCR/hiểu nhãn của MVP cần mạng. Roadmap là ML Kit OCR
on-device, sau đó chỉ gửi text cần cấu trúc hóa khi cần.
