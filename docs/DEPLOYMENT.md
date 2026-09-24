# Triển khai APK + Backend HTTPS

## 1. Mục tiêu và quality gate

Giả thuyết: một người thử nghiệm ở mạng bất kỳ có thể cài APK, nhập mã mời
riêng, chụp ảnh và nhận kết quả từ backend HTTPS mà máy phát triển không cần
chạy Metro hoặc Docker.

Đạt khi:

- APK release không phụ thuộc Expo Go, Metro, IP LAN hoặc Tailscale;
- `GET /health` trên URL cloud trả `provider=groq`;
- thiếu/sai mã mời bị từ chối `401`, mã đúng được chấp nhận;
- ảnh thật trả `demo_mode=false`, `provider=groq` và bằng chứng liên quan ảnh;
- Groq key và mã mời thô không tồn tại trong Git hoặc APK.

## 2. Kiến trúc

Tên sản phẩm hiển thị là **AIVision**. Các định danh đã phát hành như Android
package `vn.ai4life.doimataimvp`, EAS project ID/slug và URL Render được giữ ổn
định để APK mới cập nhật đè bản cũ, giữ SecureStore và không làm đứt kết nối
backend; chúng không phải tên hiển thị trên màn hình Android.

```text
Android APK
  ├─ EXPO_PUBLIC_API_BASE_URL (URL công khai, không phải secret)
  ├─ mã mời nhập bởi người dùng → Android SecureStore
  └─ HTTPS + Authorization: Bearer <mã mời>
                          │
                          ▼
Render Web Service (Singapore, Docker, có thể cold-start ở gói free)
  ├─ health check /health
  ├─ SHA-256 hash của các mã mời
  ├─ upload validation + rate limit
  └─ GROQ_API_KEY (secret server-side)
                          │
                          ▼
Groq Vision
```

Render là adapter triển khai: backend vẫn là Docker chuẩn và có thể chuyển sang
Cloud Run/Fly.io mà không đổi mobile contract. `render.yaml` hiện chọn gói
`free`; service có thể ngủ khi không có traffic nên mobile chờ tối đa 90 giây
và retry một lần với lỗi mạng/502/503/504. Muốn bỏ cold-start thì đổi sang gói
trả phí hoặc một hạ tầng luôn chạy.

## 3. Tạo mã mời

Tạo một mã riêng cho từng người. Chạy lệnh sau cho mỗi người và lưu kết quả ở
password manager; không gửi kết quả vào chat, Git hoặc log công khai:

```powershell
docker run --rm python:3.12-slim python -c "import hashlib,secrets; t=secrets.token_urlsafe(32); print('INVITE_CODE='+t); print('SHA256='+hashlib.sha256(t.encode()).hexdigest())"
```

- Gửi `INVITE_CODE` riêng cho đúng người thử nghiệm.
- Ghép các giá trị `SHA256` bằng dấu phẩy để đặt vào
  `APP_ACCESS_TOKEN_HASHES` trên Render.
- Thu hồi một người bằng cách xóa hash tương ứng rồi redeploy/restart service.

## 4. Deploy backend lên Render

Điều kiện: code hiện tại đã được commit và push lên GitHub. Repository đã có
`render.yaml` ở root. Luôn deploy backend và kiểm tra contract mới trước khi
phát hành APK mới.

1. Mở Render Dashboard → **New → Blueprint**.
2. Kết nối repository `AI4life` và chọn branch `main`.
3. Render đọc `render.yaml` và yêu cầu hai giá trị `sync: false`:
   - `GROQ_API_KEY`: key mới, chưa từng xuất hiện trong log;
   - `APP_ACCESS_TOKEN_HASHES`: danh sách hash từ bước 3.
4. Tạo Blueprint và chờ deploy có trạng thái live.
5. Ghi lại URL HTTPS, ví dụ `https://doi-mat-ai-api.onrender.com`.

Kiểm tra không cần mã:

```powershell
curl.exe https://YOUR-RENDER-HOST/health
```

Kết quả đúng:

```json
{"success":true,"data":{"status":"ok","provider":"groq"},"error":null}
```

Kiểm tra mã mời (chỉ chạy trên máy cá nhân để tránh lưu token trong CI log):

```powershell
curl.exe -H "Authorization: Bearer YOUR_INVITE_CODE" https://YOUR-RENDER-HOST/v1/access-check
```

## 5. Liên kết dự án EAS

Chạy trong thư mục mobile:

```powershell
cd D:\congnghethongtin\AI4life\apps\mobile
npx eas-cli@24.7.0 login
npx eas-cli@24.7.0 init
```

`eas init` tạo/liên kết EAS project và thêm `extra.eas.projectId` vào app config.
Không tự điền project ID giả.

Đặt URL Render cho cả preview và production. Đây là URL công khai nên dùng
visibility `plaintext`; tuyệt đối không đưa `GROQ_API_KEY` vào EAS/mobile:

```powershell
npx eas-cli@24.7.0 env:set --name EXPO_PUBLIC_API_BASE_URL --value https://YOUR-RENDER-HOST --environment preview --visibility plaintext
npx eas-cli@24.7.0 env:set --name EXPO_PUBLIC_API_BASE_URL --value https://YOUR-RENDER-HOST --environment production --visibility plaintext
```

Kiểm tra:

```powershell
npx eas-cli@24.7.0 env:list --environment preview
npx eas-cli@24.7.0 env:list --environment production
```

## 6. Build và chia sẻ APK

Từ repo root:

```powershell
cd D:\congnghethongtin\AI4life
npm run build:apk
```

Profile `preview` trong `apps/mobile/eas.json` tạo APK internal distribution.
Khi build xong, EAS trả một URL cài đặt. Chỉ gửi URL APK và mã mời qua hai kênh
khác nhau nếu ảnh thử nghiệm có tính riêng tư.

Khi cần APK dùng environment production:

```powershell
npm run build:production-apk
```

Google Play sử dụng profile `production` mặc định để tạo AAB, không dùng APK.

## 7. Smoke test trên Android thật

1. Cài APK từ EAS URL và mở app khi không chạy Metro trên máy phát triển.
2. Nhập sai mã: phải báo mã không hợp lệ.
3. Nhập đúng mã: app nói “Đã kết nối máy chủ an toàn”.
4. Lần lượt chọn **Hạn sử dụng**, **Tên sản phẩm**, **Thành phần** và **Hướng
   dẫn sử dụng**, rồi thử một ảnh, ba ảnh và chọn ảnh từ thư viện. Kết quả phải chỉ đọc mục đã chọn,
   có `provider=groq`, `demo_mode=false` và nội dung khớp ảnh.
5. Tắt Docker Desktop/máy phát triển rồi thử lại: app vẫn phải hoạt động.
6. Thu hồi hash của mã vừa thử trên Render: lần gọi tiếp theo phải trả `401`.

## 8. Vận hành, riêng tư và giới hạn

- Render và Groq phải được xem là processors của ảnh camera; chỉ chụp khi người
  dùng đồng ý và tránh mặt người/thông tin nhạy cảm nếu không cần thiết.
- Backend xử lý ảnh trong bộ nhớ, không có database và không log ảnh/OCR/token.
- Mã mời là bearer credential. SecureStore bảo vệ khi lưu trên thiết bị, nhưng
  người dùng vẫn có thể chủ động chia sẻ mã; thu hồi hash khi mất thiết bị.
- Rate limit hiện nằm trong memory của một instance. Nếu scale nhiều instance,
  chuyển rate limit sang managed gateway/Redis.
- Groq Free Plan có quota thấp cho ảnh; nhiều người đọc nhãn đồng thời có thể
  nhận `429`. Với vận hành ổn định cần nâng quota hoặc thêm OCR on-device để
  giảm số request vision.
- Rollback backend bằng Render Deploys → chọn deploy trước. Rollback mobile bằng
  phát lại APK trước; chỉ thêm EAS Update sau khi đã có quy trình kiểm thử update.

## 9. Các secret và public configuration

| Nơi | Giá trị | Có được vào Git/APK? |
|---|---|---|
| Render secret | `GROQ_API_KEY` | Không |
| Render secret | `APP_ACCESS_TOKEN_HASHES` | Không |
| Android SecureStore | mã mời thô của từng người | Không vào APK; chỉ trên thiết bị |
| EAS plaintext | `EXPO_PUBLIC_API_BASE_URL` | Có, đây không phải secret |
| EAS profile env | `EXPO_PUBLIC_REQUIRE_APP_AUTH=true` | Có, đây không phải secret |
