# Kịch bản demo Đôi Mắt AI

## 1. Giả thuyết demo

Một người dùng mới có thể dùng TalkBack để đọc đúng thông tin quan trọng trên nhãn và nhận một cảnh báo môi trường hữu ích trong dưới 90 giây.

## 2. Chuẩn bị

### Thiết bị

- Một điện thoại Android đã cài bản demo và bật TalkBack.
- Pin trên 50%, âm lượng đủ lớn, tắt thông báo gây gián đoạn.
- Mạng chính và một hotspot dự phòng.
- Bản quay màn hình dự phòng cho hai luồng.

### Vật mẫu

- Chai nước mắm có nhãn lớn.
- Chai dầu gội có hình dáng gần giống để chứng minh phân biệt bằng nhãn.
- Hộp thuốc demo còn hạn với ngày tháng nhìn rõ; không dùng thông tin sức khỏe thật.
- Một ghế hoặc thùng carton làm vật cản.
- Ảnh fixture đi kèm kết quả mong đợi để chạy regression trước khi lên sân khấu.

### Preflight

1. Xác nhận API health và quota.
2. Chạy bộ eval ảnh demo.
3. Xóa lịch sử/log có thể chứa dữ liệu.
4. Kiểm tra TTS `vi-VN`, camera permission, rung và TalkBack.
5. Chạy demo đúng vị trí, ánh sáng và mạng của sân khấu.

## 3. Demo chính — 75 đến 90 giây

### Cảnh 1: Nỗi đau — 10 giây

“Với người thị lực kém, hai chai có hình dáng giống nhau có thể dẫn đến một lựa chọn sai. Đôi Mắt AI biến chiếc điện thoại sẵn có thành trợ lý đọc nhãn bằng giọng nói.”

### Cảnh 2: Đọc nhãn — 35 giây

1. Mở ứng dụng bằng TalkBack.
2. Chạm nút lớn “Đọc nhãn”.
3. Đưa hộp thuốc hoặc chai vào khung; ứng dụng hướng dẫn căn camera.
4. Chụp ảnh.
5. Ứng dụng đọc:
   - tên hoặc loại sản phẩm;
   - hạn sử dụng nếu nhìn rõ;
   - hướng dẫn xuất hiện trên nhãn;
   - phần chưa đọc được.
6. Nhấn “Đọc toàn bộ chữ” hoặc “Chụp lại”.

Thông điệp cần nói: hệ thống không tự nghĩ ra liều thuốc; mọi thông tin quan trọng phải có bằng chứng từ nhãn.

### Cảnh 3: Thám hiểm — 25 giây

1. Chuyển sang “Thám hiểm”.
2. Hướng camera về vật cản đã chuẩn bị.
3. Nhận rung và câu ngắn “Có vật cản ở phía trước”.
4. Nhấn “Dừng”.

Thông điệp cần nói: đây là cảnh báo cảnh vật theo nhịp cho môi trường trong nhà, không thay thế công cụ hỗ trợ di chuyển.

### Cảnh 4: Bằng chứng — 15 giây

Hiển thị evaluation card:

- số ảnh đã kiểm thử;
- độ chính xác tên/loại sản phẩm;
- độ chính xác hạn sử dụng;
- latency p50/p95;
- số trường hợp hệ thống từ chối đúng khi ảnh không rõ;
- trạng thái kiểm thử TalkBack.

## 4. Demo fallback

| Sự cố | Xử lý |
|---|---|
| Mạng chậm | Dùng OCR on-device, nói rõ phần phân tích nâng cao cần mạng |
| API lỗi | Chuyển sang video quay trước, không giả là live |
| Camera không focus | Dùng vật mẫu chữ lớn hoặc ảnh fixture được gắn nhãn “Dữ liệu demo” |
| TTS không phát | Dùng màn hình chữ lớn và TalkBack |
| Thám hiểm không phát hiện | Dùng cảnh dự phòng có vật cản lớn; nếu vẫn lỗi, trình bày failure state |

## 5. Bộ test tối thiểu trước demo

- 10 ảnh nhãn: góc thẳng, nghiêng, tối, lóa, mờ.
- 5 ngày hết hạn với các định dạng khác nhau.
- 3 ảnh không có ngày hết hạn để kiểm tra hệ thống không bịa.
- 5 cảnh có vật cản thuộc tập MVP.
- 3 cảnh không có nguy cơ để đo false alarm.
- Camera permission bị từ chối.
- Mất mạng và provider timeout.
- TalkBack focus theo đúng thứ tự.
- Nút chính có label, role, state và vùng chạm tối thiểu.

## 6. Câu hỏi BGK dự kiến

### “Làm sao chứng minh AI hoạt động tốt?”

Trả evaluation card, bộ ảnh đại diện, baseline OCR và kết quả theo từng nhóm khó; không chỉ đưa một accuracy tổng.

### “Nếu AI đọc sai thuốc thì sao?”

Ứng dụng chỉ đọc chữ có bằng chứng, thể hiện confidence, từ chối khi không rõ và không đưa lời khuyên y tế. Đây là trợ lý đọc nhãn, không phải bác sĩ hay hệ thống cấp thuốc.

### “Tại sao cần AI?”

OCR xử lý chữ; vision model giúp xác định loại vật phẩm, ghép bố cục nhãn và tạo tóm tắt dễ nghe. Phần có thể giải bằng rule vẫn dùng rule.

### “Có hoạt động offline không?”

OCR và TTS có thể hoạt động cục bộ khi model đã có trên thiết bị; hiểu ngữ cảnh nâng cao của MVP cần mạng. Roadmap đưa detection sang on-device.

### “Có thay thế gậy dẫn đường không?”

Không. Thám hiểm chỉ cung cấp tín hiệu bổ sung. Thiết kế và thông điệp sản phẩm cấm tuyên bố thay thế công cụ hỗ trợ di chuyển.

