# Đôi Mắt AI

MVP AI4Life biến smartphone thành trợ lý thị giác cho người khiếm thị, người
thị lực kém và người lớn tuổi.

- **Đọc nhãn:** chụp bao bì, nghe tên sản phẩm, hạn sử dụng và phần chữ quan
  trọng có bằng chứng.
- **Thám hiểm:** quét cảnh mỗi ba giây, cảnh báo một tập nguy cơ giới hạn bằng
  tiếng Việt và rung.

> Thám hiểm không thay thế gậy, chó dẫn đường hoặc người hỗ trợ. Ứng dụng không
> đưa chẩn đoán, liều dùng hoặc lời khuyên y tế.

## Trạng thái MVP

- Expo Android bundle: build thành công.
- FastAPI fixture mode: chạy được không cần external AI key.
- OpenAI Responses vision: adapter thật, bật bằng environment variables.
- External AI lỗi: tự chuyển sang dữ liệu mẫu và gắn badge rõ ràng.
- Backend tests: 12 test.
- Mobile tests: 6 test.
- Evaluation: synthetic fixtures, chỉ chứng minh pipeline chứ không chứng minh
  accuracy ngoài đời.

Tài liệu:

- [Architecture](docs/ARCHITECTURE.md)
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

MVP không dùng database hoặc authentication vì không có account và không lưu
dữ liệu người dùng. Nếu public API được mở ngoài demo network, cần thêm user
identity/attestation ở gateway; shared secret trong mobile bundle không phải
biện pháp bảo mật hợp lệ.

## Chạy nhanh

Yêu cầu: Node.js 22+, npm và Docker Compose.

```bash
cp .env.example .env
npm ci
docker compose up -d api
curl http://localhost:8000/health
```

Health response:

```json
{"success":true,"data":{"status":"ok","provider":"fixture"},"error":null}
```

Đặt địa chỉ IP LAN của máy chạy API trước khi mở ứng dụng trên điện thoại:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8000 npm run mobile
```

Điện thoại và máy phát triển phải truy cập được nhau. `localhost` trên điện
thoại là chính điện thoại, không phải máy chạy backend.

## Bật OpenAI vision

```bash
VISION_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-6-astra
ALLOW_FIXTURE_FALLBACK=true
```

Khởi động lại API sau khi đổi env:

```bash
docker compose up -d --build api
```

API key chỉ tồn tại ở backend. Responses request dùng `store: false`; ứng dụng
không log hoặc lưu ảnh/OCR text. Khi provider lỗi và fallback được bật, response
có `demo_mode: true` và UI hiện “CHẾ ĐỘ DỮ LIỆU MẪU”.

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
- `POST /v1/analyze-label`: multipart `image`, tùy chọn `ocr_text`, `locale`.
- `POST /v1/analyze-scene`: multipart `image`, tùy chọn `locale`.
- OpenAPI: http://localhost:8000/docs

Ảnh hợp lệ: JPEG, PNG hoặc WEBP, tối đa 5 MB. API kiểm tra cả MIME và file
signature, rate-limit theo IP, gắn request ID và trả error envelope nhất quán.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VISION_PROVIDER` | `fixture` | `fixture` hoặc `openai` |
| `ALLOW_FIXTURE_FALLBACK` | `true` | Giữ demo chạy khi provider thật lỗi |
| `OPENAI_API_KEY` | rỗng | Chỉ cần khi dùng OpenAI |
| `OPENAI_MODEL` | `gpt-6-astra` | Model vision cấu hình từ backend |
| `PROVIDER_TIMEOUT_SECONDS` | `12` | Timeout external provider |
| `MAX_UPLOAD_BYTES` | `5242880` | Giới hạn upload |
| `RATE_LIMIT_REQUESTS` | `30` | Số request mỗi cửa sổ/IP |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Cửa sổ rate limit |
| `ALLOWED_ORIGINS` | local Expo URLs | CORS allowlist |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:8000` | API URL public cho mobile |

## Giới hạn còn lại

- Chưa kiểm thử camera, TalkBack, TTS và haptics trên thiết bị Android thật.
- Chưa có OCR on-device native adapter; MVP hiện gửi ảnh tới backend vision.
- Dataset hiện là synthetic và không đại diện cho nhãn tiếng Việt ngoài đời.
- Scene mode không đo khoảng cách, depth hoặc hướng chuyển động.
- npm audit báo 10 advisory mức moderate trong Expo build toolchain; npm chỉ đề
  xuất downgrade phá vỡ xuống Expo 46, nên chưa tự động áp dụng.
