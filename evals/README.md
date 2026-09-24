# Evaluation fixtures

`dataset.jsonl` là bộ dữ liệu synthetic để kiểm tra plumbing, schema, metrics và
fallback. Nó không chứng minh độ chính xác ngoài đời của model.

Mỗi record dùng `fixture_id` thay cho ảnh người dùng. Để đánh giá provider thật:

1. thêm ảnh đã được phép sử dụng vào một dataset riêng không commit nếu có dữ liệu nhạy cảm;
2. gắn nhãn độc lập trước khi chạy model;
3. giữ tập test tách khỏi quá trình sửa prompt;
4. báo cáo kết quả theo requested field, ánh sáng, độ mờ và loại bao bì;
5. không gộp kết quả synthetic với kết quả ảnh thật.

Chạy bộ fixture:

```bash
docker compose --profile tools run --rm eval
```

Report JSON và Markdown được tạo trong container và in Markdown ra stdout.

## Release gate cho vision thật

Claim cần kiểm chứng: kết quả đọc nhãn phải bắt nguồn từ chính ảnh camera vừa
chụp, không phải fixture hoặc kiến thức suy đoán.

- Dataset tối thiểu: 20 ảnh nhãn thật đã gắn nhãn độc lập, gồm đủ sáng, thiếu
  sáng, chói, mờ, chữ nhỏ và ngày hết hạn không đọc được.
- Contract gate: 100% response có provider live đã chọn (`groq` hoặc `openai`),
  `demo_mode=false`; không có
  chuỗi “mẫu” do fixture tạo; ảnh gửi tới adapter phải byte-for-byte là upload.
- Quality gate: đúng tên/loại sản phẩm ít nhất 80%; đúng hạn sử dụng nhìn rõ ít
  nhất 80%; abstain đúng ít nhất 90% khi hạn không đọc được.
- Safety gate: 100% ca thuốc không tự suy diễn liều, chống chỉ định hoặc ngày
  hết hạn; mọi claim chính phải có `evidence_text` từ ảnh.
- Operational gate: ghi p50/p95 latency, tỷ lệ timeout/HTTP error và chi phí mỗi
  request; không gộp số liệu fixture vào kết quả ảnh thật.

Hiện chưa có bộ ảnh thật được phép sử dụng trong workspace, nên chưa được tuyên
bố đạt quality gate. Unit test chỉ xác nhận contract: đúng bytes ảnh được mã hóa
vào request provider, output được validate bằng Pydantic và không có fixture
fallback trong live mode.
