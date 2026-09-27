# Triển khai QR Care lên production

Tài liệu cho người đưa QR Care lên máy chủ thật. Vận hành hằng ngày (sao lưu, giám sát, xử lý sự cố) nằm ở [operations.md](operations.md).

> Chưa có môi trường production nào được tạo. Việc thuê máy chủ, mua domain, đăng ký SMTP/SMS là quyết định của chủ dự án — tài liệu này mô tả cách làm khi đã chọn.

## Kiến trúc production

```text
Điện thoại / trình duyệt
        │  HTTPS (443)
        ▼
Reverse proxy (nginx hoặc load balancer của nền tảng) ── cấp chứng chỉ TLS, chuyển HTTP → HTTPS
        │  HTTP nội bộ (127.0.0.1:4000)
        ▼
Container "app" (Node 24) ── một tiến trình phục vụ cả API (/api/*) lẫn giao diện React đã build
        │                    volume "storage": ảnh đại diện
        ▼
Container "db" (PostgreSQL 17) ── volume "db", không mở cổng ra ngoài
```

- **Một origin duy nhất**: giao diện và API cùng domain → cookie `SameSite=Strict`, không cần CORS.
- App tự gửi mọi header bảo mật (CSP chặt cho giao diện, `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`) và nén gzip. Reverse proxy chỉ lo TLS.
- Khi khởi động, container tự chạy migration database (`MIGRATE_ON_START=true`), sau đó mới nhận request. Mỗi 6 giờ tự dọn phiên đăng nhập/OTP hết hạn.
- Khi nhận `SIGTERM` (dừng/cập nhật), app ngừng nhận kết nối mới, trả nốt request đang xử lý rồi đóng kết nối DB.

Các file liên quan:

| File                            | Vai trò                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `Dockerfile`                    | Build image production (chỉ chứa code đã build + dependency runtime)           |
| `deploy/compose.yml`            | App + PostgreSQL trên một máy chủ, volume lưu dữ liệu, giới hạn dung lượng log |
| `deploy/production.env.example` | Mẫu cấu hình production (bản thật `deploy/production.env` bị git bỏ qua)       |
| `deploy/nginx.conf`             | Mẫu reverse proxy HTTPS                                                        |
| `deploy/backup.sh`              | Sao lưu database + ảnh đại diện (xem [operations.md](operations.md))           |

## Việc cần chốt trước khi lên production

| Việc                        | Vì sao quan trọng                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Domain vĩnh viễn cho QR** | Link trong QR (`PUBLIC_QR_BASE_URL`) được in lên áo và **không sửa được**. Đổi domain = mọi áo đã bán quét ra trang lỗi. Chọn domain sẽ gia hạn lâu dài. |
| Máy chủ                     | VPS Linux tối thiểu 1 vCPU, 2 GB RAM, 20 GB SSD (mỗi lần băm mật khẩu dùng ~19 MB RAM). Hoặc nền tảng chạy container (xem cuối tài liệu).                |
| Tài khoản SMTP              | Để khách tự khôi phục mật khẩu qua email. Chưa có thì đặt `EMAIL_PROVIDER=disabled` (admin vẫn reset mật khẩu cho khách được).                           |
| Nhà cung cấp SMS            | Chưa tích hợp. Khôi phục qua SĐT sẽ báo "chưa hỗ trợ" cho đến khi chọn nhà cung cấp (cần brandname, có phí).                                             |
| Nơi lưu bản sao lưu         | Một nơi **ngoài** máy chủ (ổ khác, dịch vụ lưu trữ) — mất máy chủ không được mất dữ liệu.                                                                |

## Triển khai trên VPS bằng Docker Compose

Các lệnh dưới đây chạy trên máy chủ Linux (Ubuntu/Debian) đã cài **Docker Engine + Docker Compose plugin**, **nginx** và **certbot**.

### 1. Chuẩn bị máy chủ

- Trỏ bản ghi DNS `A` (và `AAAA` nếu có IPv6) của domain về IP máy chủ.
- Tường lửa chỉ mở cổng 22 (SSH), 80, 443. Cổng 4000 của app chỉ lắng nghe trên `127.0.0.1`; PostgreSQL không mở cổng nào.
- Đăng nhập SSH bằng khóa, tắt đăng nhập bằng mật khẩu; bật cập nhật bảo mật tự động của hệ điều hành.

### 2. Lấy mã nguồn và tạo cấu hình

```bash
sudo git clone https://github.com/HaiDang193/Qr_Web.git /opt/qrcare
cd /opt/qrcare
sudo cp deploy/production.env.example deploy/production.env
sudo chmod 600 deploy/production.env
sudo nano deploy/production.env
```

Sinh giá trị ngẫu nhiên cho `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `OTP_SECRET` (mỗi biến một giá trị khác nhau):

```bash
openssl rand -base64 48 | tr '+/' '-_' | tr -d '='
```

Điền domain vào `APP_ORIGIN` và `PUBLIC_QR_BASE_URL`, thông tin SMTP (hoặc `EMAIL_PROVIDER=disabled`). **App từ chối khởi động** nếu còn giá trị mẫu, secret ngắn hơn 32 ký tự, hai secret trùng nhau, `PUBLIC_QR_BASE_URL` không phải `https://`, hoặc chọn provider `console` (in OTP ra log) — log sẽ ghi tên biến sai (không bao giờ ghi giá trị).

### 3. Build và khởi động

```bash
sudo docker compose --env-file deploy/production.env -f deploy/compose.yml up -d --build
sudo docker compose --env-file deploy/production.env -f deploy/compose.yml ps     # app: (healthy)
sudo docker compose --env-file deploy/production.env -f deploy/compose.yml logs app --tail 20
curl -s http://127.0.0.1:4000/api/health   # {"success":true,"data":{"status":"ok","database":"up"}}
```

Mẹo: đặt alias để khỏi gõ dài — `alias qrc='sudo docker compose --env-file /opt/qrcare/deploy/production.env -f /opt/qrcare/deploy/compose.yml'`. Các ví dụ sau dùng `qrc`.

### 4. HTTPS với nginx

```bash
sudo certbot certonly --nginx -d qrcare.example.vn        # thay bằng domain thật
sudo cp deploy/nginx.conf /etc/nginx/sites-available/qrcare
sudo sed -i 's/qrcare.example.vn/<domain-that>/g' /etc/nginx/sites-available/qrcare
sudo ln -s /etc/nginx/sites-available/qrcare /etc/nginx/sites-enabled/qrcare
sudo nginx -t && sudo systemctl reload nginx
```

Mẫu `deploy/nginx.conf` đã được kiểm tra bằng `nginx -t` và chạy thử (HTTP → 301 HTTPS, header bảo mật của app giữ nguyên qua proxy). Nó đặt `X-Forwarded-For` bằng đúng IP người dùng, khớp `TRUST_PROXY=1` — rate limit tính theo IP thật. Certbot tự gia hạn chứng chỉ.

### 5. Tạo tài khoản admin đầu tiên

```bash
qrc exec app node dist/scripts/seed-admin.js admin@congty.vn
```

Mật khẩu tạm in ra **một lần** — đăng nhập tại `https://<domain>/login` và đổi ngay (hệ thống bắt buộc). Quên mật khẩu admin: thêm `--reset` vào lệnh trên. Muốn tự đặt mật khẩu: `qrc exec -e ADMIN_PASSWORD='...' app node dist/scripts/seed-admin.js <email>`.

### 6. Kiểm tra sau khi lên

1. Mở `https://<domain>` → trang đăng nhập, ổ khóa HTTPS hợp lệ.
2. Đăng nhập admin, đổi mật khẩu, tạo một khách hàng thử có ảnh đại diện.
3. Tải QR, **quét bằng điện thoại thật** (4G, không Wi‑Fi công ty) → hiện trang thông tin công khai với đúng domain.
4. Thử "Quên mật khẩu" bằng email của khách thử (nếu đã cấu hình SMTP) → nhận được mã.
5. Chạy `deploy/backup.sh` một lần và xem [operations.md](operations.md) để lên lịch sao lưu.
6. Vô hiệu hóa khách hàng thử khi xong.

## Cập nhật phiên bản mới

```bash
cd /opt/qrcare
sudo deploy/backup.sh                       # luôn sao lưu trước khi cập nhật
sudo git pull
qrc up -d --build                           # build image mới, thay container, migration tự chạy
qrc logs app --tail 20                      # thấy "Database migrations applied" và "listening"
```

- Thời gian gián đoạn: vài giây khi container cũ dừng và container mới khởi động.
- Migration chỉ chạy tiến (không có migration lùi). Nếu bản mới lỗi sau khi migration đã chạy: quay về commit cũ **và** khôi phục bản sao lưu vừa tạo (quy trình ở [operations.md](operations.md#khôi-phục)).
- Cập nhật định kỳ image nền (vá bảo mật Node/Debian/PostgreSQL): `qrc build --pull && qrc up -d`.

## Biến môi trường

Đặt trong `deploy/production.env`. Biến có giá trị mặc định trong image thì không cần khai báo.

| Biến                                | Bắt buộc | Mặc định        | Ý nghĩa                                                                                   |
| ----------------------------------- | -------- | --------------- | ----------------------------------------------------------------------------------------- |
| `NODE_ENV`                          | ✔        | `production`    | Bật các kiểm tra an toàn production, cookie `Secure`                                      |
| `APP_ORIGIN`                        | ✔        |                 | Địa chỉ website, ví dụ `https://qrcare.vn`. Request ghi dữ liệu từ origin khác bị từ chối |
| `PUBLIC_QR_BASE_URL`                | ✔        |                 | Phần đầu link trong QR (`https://…`). **Không đổi sau khi đã in áo**                      |
| `POSTGRES_PASSWORD`                 | ✔        |                 | Mật khẩu database (compose tự tạo `DATABASE_URL`)                                         |
| `JWT_ACCESS_SECRET`                 | ✔        |                 | Khóa ký phiên đăng nhập, ≥ 32 ký tự. Đổi = mọi người bị đăng xuất                         |
| `OTP_SECRET`                        | ✔        |                 | Khóa băm mã OTP, ≥ 32 ký tự, khác `JWT_ACCESS_SECRET`                                     |
| `TRUST_PROXY`                       |          | `0`             | Số proxy phía trước app. Sau nginx: `1`. Sai giá trị → rate limit tính sai IP             |
| `EMAIL_PROVIDER`                    |          | —               | `smtp` hoặc `disabled` (`console` bị cấm ở production)                                    |
| `EMAIL_FROM`                        |          |                 | Người gửi, ví dụ `QR Care <no-reply@qrcare.vn>`                                           |
| `SMTP_HOST` / `SMTP_PORT`           | nếu smtp | — / `587`       | Máy chủ SMTP                                                                              |
| `SMTP_SECURE`                       |          | `false`         | `true` cho cổng 465 (TLS ngay), `false` cho 587 (STARTTLS)                                |
| `SMTP_USER` / `SMTP_PASS`           |          |                 | Tài khoản SMTP                                                                            |
| `SMS_PROVIDER`                      |          | —               | Hiện chỉ `disabled` ở production                                                          |
| `LOG_LEVEL`                         |          | `info`          | `warn` để giảm log, `debug` khi điều tra sự cố                                            |
| `DATABASE_POOL_MAX`                 |          | `10`            | Số kết nối DB tối đa                                                                      |
| `MIGRATE_ON_START`                  |          | `true`          | Tự chạy migration khi container khởi động                                                 |
| `STORAGE_LOCAL_DIR`                 |          | `/data/storage` | Thư mục ảnh đại diện (đã gắn volume)                                                      |
| `APP_PORT` (chỉ dùng trong compose) |          | `4000`          | Cổng trên máy chủ mà nginx chuyển tới                                                     |

## Chạy không dùng Docker

Được hỗ trợ nếu máy chủ đã có Node.js 24 và PostgreSQL 15+:

```bash
npm ci
npm run build
cd backend
NODE_ENV=production HOST=127.0.0.1 PORT=4000 \
FRONTEND_DIST_DIR=../frontend/dist STORAGE_LOCAL_DIR=/var/lib/qrcare/storage \
DATABASE_URL=postgres://... APP_ORIGIN=... PUBLIC_QR_BASE_URL=... JWT_ACCESS_SECRET=... OTP_SECRET=... \
EMAIL_PROVIDER=smtp SMTP_HOST=... SMS_PROVIDER=disabled TRUST_PROXY=1 \
node dist/scripts/start-production.js
```

- Thay vì truyền trên dòng lệnh, có thể ghi các biến vào `backend/.env` (quyền `600`); biến đặt sẵn trong môi trường được ưu tiên hơn file này.
- Dùng systemd (hoặc trình quản lý tiến trình tương đương) để tự khởi động lại khi lỗi hoặc khi máy chủ khởi động lại.
- Sao lưu thư mục `STORAGE_LOCAL_DIR` cùng database (`deploy/backup.sh` dành cho bản Docker; bản này dùng `pg_dump` và `tar` trực tiếp).

## Nền tảng chạy container (PaaS)

Dockerfile dùng được trên các nền tảng nhận Dockerfile. Dự án không gắn cứng với nhà cung cấp nào; khi chọn, cần:

- **Ổ đĩa bền vững gắn vào `/data/storage`** — nhiều nền tảng có ổ đĩa tạm, mất khi deploy lại → mất ảnh đại diện.
- PostgreSQL có sao lưu tự động (dịch vụ managed), đặt `DATABASE_URL` trực tiếp.
- Health check: `GET /api/health` (200 = ổn, 503 = mất kết nối DB).
- `TRUST_PROXY` đúng số lớp proxy của nền tảng (thường `1`).
- Chạy **một** instance (xem giới hạn bên dưới).

## Giới hạn khi mở rộng nhiều instance

Thiết kế hiện tại dành cho **một** container app. Chạy nhiều instance song song cần làm thêm (sẽ hỏi trước khi làm):

| Thành phần        | Vấn đề khi có nhiều instance                      | Hướng xử lý                                            |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------ |
| Rate limit        | Đếm trong bộ nhớ từng instance → giới hạn bị nhân | Store dùng chung (Redis)                               |
| Ảnh đại diện      | Lưu ổ đĩa cục bộ, instance khác không thấy        | Storage S3-compatible (đã có abstraction)              |
| Migration         | Nhiều instance cùng chạy migration lúc khởi động  | `MIGRATE_ON_START=false`, chạy migration một lần riêng |
| Dọn phiên hết hạn | Mỗi instance đều chạy — vô hại (idempotent)       | Không cần xử lý                                        |

## Checklist bảo mật khi triển khai

- [ ] `deploy/production.env` quyền `600`, không nằm trong Git (đã có trong `.gitignore`).
- [ ] Mọi secret sinh ngẫu nhiên, mỗi biến một giá trị; không dùng lại giá trị từ máy dev.
- [ ] Chỉ mở cổng 22/80/443; PostgreSQL và cổng 4000 không truy cập được từ Internet.
- [ ] HTTPS hoạt động, HTTP chuyển hướng sang HTTPS.
- [ ] Đã đổi mật khẩu tạm của admin; mỗi người quản trị một tài khoản riêng.
- [ ] Sao lưu tự động đã lên lịch, có bản sao ngoài máy chủ, **đã thử khôi phục**.
- [ ] Có giám sát `/api/health` từ bên ngoài (xem [operations.md](operations.md)).
- [ ] Đã quét QR thật bằng điện thoại trên domain chính thức trước khi in áo hàng loạt.
