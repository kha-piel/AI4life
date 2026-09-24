# AIVision

MVP AIVision biến smartphone thành trợ lý thị giác cho người khiếm thị, người
thị lực kém và người lớn tuổi.

- **Một luồng đọc đầy đủ:** đọc tên, hạn sử dụng, thành phần, hướng dẫn và bảng
  dinh dưỡng trong cùng một lượt.
- **Nhiều góc nhãn:** chụp hoặc chọn từ thư viện tối đa 3 ảnh của cùng một sản
  phẩm rồi phân tích trong một request.
- **Sàng lọc tiểu đường tích hợp:** nút “Bắt đầu đọc nhãn” tự động phân tích khẩu
  phần, tổng carbohydrate, đường, chất xơ và thành phần nhìn thấy; từ chối kết luận
  khi thiếu bảng dinh dưỡng.

> Đánh giá sức khỏe chỉ hỗ trợ sàng lọc từ nhãn, không chẩn đoán, không hướng dẫn
> insulin/thuốc và không thay thế bác sĩ hoặc chuyên gia dinh dưỡng.

## Trạng thái MVP

- Expo Android bundle: build thành công.
- Groq vision (`qwen/qwen3.8-27b`): đường chạy mặc định cho ảnh camera thật.
- OpenAI Responses vẫn là provider tùy chọn qua cùng interface.
- Live mode fail-closed: thiếu key hoặc external AI lỗi thì trả lỗi, không tráo dữ liệu mẫu.
- Fixture chỉ dùng cho test/evaluation offline, không nằm trong đường chạy Android.
- Backend tests: 35 test.
- Mobile tests: 16 test.
- Evaluation: synthetic fixtures, chỉ chứng minh pipeline chứ không chứng minh
  accuracy ngoài đời.

Tài liệu:

- [Architecture](docs/ARCHITECTURE.md)
- [APK + cloud deployment](docs/DEPLOYMENT.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Demo plan](docs/DEMO_PLAN.md)
- [Master build prompt](prompts/BUILD_MVP.md)
- [Evaluation card mới nhất](evals/reports/latest.md)

## Cấu trúc

```text
apps/
├── api/                 FastAPI, providers, upload validation, tests
└── mobile/              Expo/React Native, camera, TTS, haptics, tests
docs/                    Architecture, plan và demo
evals/                   Dataset synthetic và evaluation runner
prompts/                 Prompt build MVP
.ai4life/skills/         Workflow skills của team
docker-compose.yml       API và evaluation service
```

MVP không dùng database hoặc account system và không lưu dữ liệu người dùng.
Cloud mode bảo vệ API bằng mã mời riêng cho từng người: Android lưu mã trong
SecureStore, backend chỉ giữ SHA-256 hash và có thể thu hồi từng mã. Đây là lớp
kiểm soát truy cập cho nhóm thử nghiệm, không thay thế identity/attestation ở
gateway nếu sản phẩm được mở rộng công khai.

## Chạy nhanh

Yêu cầu: Node.js 22+, npm và Docker Compose.

```bash
cp .env.example .env
# Điền GROQ_API_KEY trong .env trên máy local; không gửi key vào mobile.
npm ci
docker compose up -d api
curl http://localhost:8000/health
```

Health response:

```json
{"success":true,"data":{"status":"ok","provider":"groq"},"error":null}
```

Chạy Expo từ repo root. Trong development, mobile tự lấy host của Metro và gọi
API qua dev proxy `/api`, nên không hard-code IP LAN:

```bash
npm run mobile
```

Điện thoại và máy phát triển phải truy cập được nhau. `localhost` trên điện
thoại là chính điện thoại, không phải máy chạy backend.

## Groq vision thật (mặc định)

```bash
VISION_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=qwen/qwen3.8-27b
ALLOW_FIXTURE_FALLBACK=false
```

Khởi động lại API sau khi đổi env:

```bash
docker compose up -d --build api
```

API key chỉ tồn tại ở backend. Groq nhận ảnh qua `chat/completions` JSON mode;
Pydantic kiểm tra lại schema trước khi trả về mobile. Ứng dụng không log hoặc
lưu ảnh/OCR text. Nếu key thiếu, key sai, provider timeout hoặc provider lỗi,
API trả lỗi rõ ràng và không tạo kết quả fixture thay cho ảnh thật.

OpenAI vẫn dùng được bằng cách đặt `VISION_PROVIDER=openai`, `OPENAI_API_KEY`
và `OPENAI_MODEL`; adapter OpenAI gửi Responses request với `store: false`.

## Chia sẻ APK qua Internet

Đường chạy chia sẻ cho nhóm thử nghiệm là APK EAS Internal Distribution gọi
backend Docker trên Render qua HTTPS. Cloud mode yêu cầu mã mời riêng cho từng
người; mã được lưu bằng Android SecureStore và backend chỉ giữ SHA-256 hash.

Xem toàn bộ quy trình, secret boundaries, smoke test và rollback tại
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm run test:mobile
docker compose run --rm api pytest
docker compose --profile tools run --rm eval
npm run build:mobile
```

Evaluation report được ghi vào `evals/reports/latest.{json,md}`.

## API

- `GET /health`
- `GET /v1/access-check`: kiểm tra mã mời trong cloud mode.
- `POST /v1/analyze-label`: multipart một `image` cũ hoặc tối đa ba trường
  `images`, `requested_field`, tùy chọn `health_condition=diabetes`, `ocr_text`,
  `locale`. APK mới luôn dùng `requested_field=all`; các target cũ được giữ để
  tương thích APK đã phát hành.
- OpenAPI: http://localhost:8000/docs

Ảnh hợp lệ: JPEG, PNG hoặc WEBP, tối đa 5 MB mỗi ảnh, 12 MB tổng và 3 ảnh mỗi lượt. API kiểm
tra cả MIME và file signature, rate-limit theo IP, gắn request ID và trả error
envelope nhất quán.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VISION_PROVIDER` | `groq` | `groq` mặc định; hỗ trợ `openai`; `fixture` chỉ cho test/eval |
| `ALLOW_FIXTURE_FALLBACK` | `false` | Phải `false` trong live mode để không trả dữ liệu mẫu |
| `GROQ_API_KEY` | rỗng | Bắt buộc khi dùng Groq; chỉ đặt ở backend |
| `GROQ_MODEL` | `qwen/qwen3.8-27b` | Model Groq có hỗ trợ ảnh và JSON mode |
| `OPENAI_API_KEY` | rỗng | Bắt buộc khi dùng OpenAI; chỉ đặt ở backend |
| `OPENAI_MODEL` | `gpt-6-astra` | Model vision cấu hình từ backend |
| `PROVIDER_TIMEOUT_SECONDS` | `30` | Timeout external provider |
| `REQUIRE_APP_AUTH` | `false` | Bật kiểm tra mã mời Bearer cho cloud mode |
| `APP_ACCESS_TOKEN_HASHES` | rỗng | Danh sách SHA-256 hash của mã mời; chỉ đặt ở backend |
| `MAX_UPLOAD_BYTES` | `5242880` | Giới hạn upload |
| `RATE_LIMIT_REQUESTS` | `30` | Số request mỗi cửa sổ/IP |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Cửa sổ rate limit |
| `ALLOWED_ORIGINS` | local Expo URLs | CORS allowlist |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:8000` | API URL public cho mobile |
| `EXPO_PUBLIC_REQUIRE_APP_AUTH` | `false` | Bật màn hình nhập mã mời trong APK cloud |

## Giới hạn còn lại

- Chưa kiểm thử camera, chọn nhiều ảnh, TalkBack, TTS và haptics trên thiết bị
  Android thật.
- Nút chụp chờ `onCameraReady`, capture lỗi được retry một lần và request mạng
  tạm lỗi được retry có giới hạn; vẫn cần kiểm thử nhiều thiết bị thật.
- Chưa có OCR on-device native adapter; MVP hiện dùng model vision để OCR, trích
  xuất toàn bộ nhãn và đánh giá có cấu trúc trong cùng một request.
- Dataset hiện là synthetic và không đại diện cho nhãn tiếng Việt ngoài đời.
- Phân tích bệnh nền hiện chỉ hỗ trợ tiểu đường; chưa hỗ trợ tăng huyết áp, bệnh
  thận, dị ứng hoặc lời khuyên cá nhân hóa theo thuốc/liều điều trị.
- npm audit báo 10 advisory mức moderate trong Expo build toolchain; npm chỉ đề
  xuất downgrade phá vỡ xuống Expo 46, nên chưa tự động áp dụng.
