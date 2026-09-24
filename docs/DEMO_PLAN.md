# Kịch bản demo AIVision

## 1. Giả thuyết demo

Một người dùng mới có thể chọn đúng mục cần đọc, chụp nhãn và nghe câu trả lời
ngắn có bằng chứng trong dưới 60 giây.

## 2. Chuẩn bị

### Thiết bị

- Điện thoại Android đã cài APK mới và bật TalkBack.
- Pin trên 50%, âm lượng đủ lớn, quyền camera đã cấp.
- Mạng chính và hotspot dự phòng.
- Mở `/health` trước demo nếu dùng Render Free.

### Vật mẫu

- Một sản phẩm có HSD đủ ngày/tháng/năm nhìn rõ.
- Một sản phẩm chỉ có tháng/năm.
- Một nhãn có mục Thành phần.
- Một nhãn có Hướng dẫn sử dụng.
- Một nhãn mờ hoặc không có HSD để chứng minh hệ thống từ chối suy đoán.

## 3. Demo chính — 60 giây

### Cảnh 1: Nỗi đau — 10 giây

“Người thị lực kém thường chỉ cần biết một thông tin, nhưng ứng dụng lại đọc cả
đoạn dài. AIVision cho chọn mục trước rồi chỉ đọc đúng phần cần thiết.”

### Cảnh 2: Hạn sử dụng — 25 giây

1. TalkBack đọc màn hình “Bạn muốn đọc gì?”.
2. Chọn nút lớn “Hạn sử dụng”.
3. App hướng dẫn đưa chữ HSD/EXP vào khung.
4. Chờ nút chụp được bật rồi chụp.
5. App đọc một câu, ví dụ “Hạn sử dụng: ngày 15 tháng 10 năm 2027”.
6. Chỉ ra dòng “Chữ nhìn thấy” làm bằng chứng.

### Cảnh 3: Thành phần hoặc tên sản phẩm — 15 giây

1. Quay lại và chọn một mục khác.
2. Chụp phần tương ứng trên nhãn.
3. App chỉ đọc mục đã chọn, không lặp lại toàn bộ nhãn.

### Cảnh 4: Guardrail — 10 giây

Chụp nhãn không có HSD hoặc quá mờ. App phải nói chưa đọc rõ và yêu cầu chụp lại,
không biến ngày sản xuất thành hạn sử dụng.

## 4. Demo fallback

| Sự cố | Xử lý |
|---|---|
| Render đang ngủ | Mở `/health`, chờ `status=ok`, thử lại |
| Provider lỗi | Hiển thị failure state hoặc video quay trước; không giả là live |
| Camera chưa sẵn sàng | Chờ hướng dẫn đổi từ “Đang khởi động camera” rồi mới chụp |
| Camera không focus | Chụp gần hơn, đủ sáng, giữ yên hoặc dùng vật mẫu chữ lớn |
| TTS không phát | Dùng chữ lớn và TalkBack |

## 5. Bộ test tối thiểu trước demo

- 5 ảnh HSD rõ với định dạng Việt/Anh khác nhau.
- 3 ảnh có NSX và HSD để kiểm tra phân biệt đúng.
- 3 ảnh không có HSD để kiểm tra abstention.
- 3 nhãn thành phần và 3 nhãn hướng dẫn.
- Ảnh thẳng, nghiêng, tối, lóa và mờ.
- Chụp liên tục 10 lần để kiểm tra camera lifecycle.
- Render cold-start, mất mạng và provider timeout.
- TalkBack focus, label, role, state và vùng chạm.

## 6. Câu hỏi BGK dự kiến

### “Tại sao không đọc toàn bộ nhãn?”

Âm thanh dài làm tăng tải nhận thức. Chọn mục trước giúp người dùng nhận đúng thông
tin cần thiết nhanh hơn và prompt tập trung hơn.

### “Tại sao cần AI?”

Nhãn có bố cục, góc chụp và định dạng đa dạng. Model vision thực hiện OCR và ghép
ngữ cảnh; schema, target prompt và validation deterministic giới hạn đầu ra.

### “Nếu AI đọc sai thuốc thì sao?”

Ứng dụng chỉ đọc nội dung có bằng chứng, thể hiện confidence, từ chối khi không rõ
và không đưa lời khuyên y tế. Đây là trợ lý đọc nhãn, không phải hệ thống cấp thuốc.

### “Có hoạt động offline không?”

TTS có thể chạy cục bộ; OCR/hiểu nhãn của MVP cần mạng. Roadmap là ML Kit OCR
on-device, sau đó chỉ gửi text cần cấu trúc hóa khi cần.
