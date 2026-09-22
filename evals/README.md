# Evaluation fixtures

`dataset.jsonl` là bộ dữ liệu synthetic để kiểm tra plumbing, schema, metrics và
fallback. Nó không chứng minh độ chính xác ngoài đời của model.

Mỗi record dùng `fixture_id` thay cho ảnh người dùng. Để đánh giá provider thật:

1. thêm ảnh đã được phép sử dụng vào một dataset riêng không commit nếu có dữ liệu nhạy cảm;
2. gắn nhãn độc lập trước khi chạy model;
3. giữ tập test tách khỏi quá trình sửa prompt;
4. báo cáo kết quả theo ánh sáng, độ mờ, loại bao bì và loại nguy cơ;
5. không gộp kết quả synthetic với kết quả ảnh thật.

Chạy bộ fixture:

```bash
docker compose --profile tools run --rm eval
```

Report JSON và Markdown được tạo trong container và in Markdown ra stdout.

