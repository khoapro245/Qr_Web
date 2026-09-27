# Checklist bảo mật QR Care

Đối chiếu yêu cầu bảo mật của spec (§21, §38, §39, §40) với cách triển khai và bằng chứng kiểm tra.
Rà soát lần cuối: Milestone 10.

- **Test**: file test tự động trong `backend/tests` / `frontend/tests` (chạy bằng `npm test`).
- **Thử thực tế**: tấn công hộp đen vào ứng dụng đang chạy (48 kịch bản) + trình duyệt thật.

## Xác thực & phiên

| Yêu cầu                        | Triển khai                                                                                                          | Kiểm tra                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Mật khẩu hash                  | Argon2id (19 MiB, t=2)                                                                                              | `utils/password.test.ts`                                 |
| JWT an toàn                    | HS256 cố định, kiểm tra `iss`/`aud`/`exp`; `alg=none`, sai khóa, sửa `role` đều bị từ chối; vai trò lấy từ DB       | `security.test.ts`, thử thực tế                          |
| Không lưu token ở localStorage | Chỉ cookie `HttpOnly`; header `Authorization` bị bỏ qua                                                             | `security.test.ts`                                       |
| Cookie an toàn                 | `HttpOnly`, `SameSite=Strict`, `Secure` khi production, refresh token giới hạn `Path=/api/auth`                     | `auth.test.ts`, `security.test.ts` (cấu hình production) |
| Đăng xuất / thu hồi            | Thu hồi cả session family; kiểm tra DB mỗi request → hiệu lực ngay                                                  | `auth.test.ts`                                           |
| Refresh token bị đánh cắp      | Xoay vòng; dùng lại token cũ → thu hồi cả chuỗi                                                                     | `auth.test.ts`                                           |
| Dò mật khẩu                    | Khóa 15 phút sau 5 lần sai + giới hạn IP                                                                            | `auth.test.ts`                                           |
| Dò tài khoản                   | Cùng lỗi cho "không tồn tại"/"sai mật khẩu"; Argon2 giả để cân bằng thời gian; quên mật khẩu luôn trả cùng response | `auth.test.ts`, `password-reset.test.ts`                 |
| OTP                            | HMAC có khóa, 10 phút, 1 lần, 5 lượt (trừ trước khi so sánh), cooldown 60s, 5 mã/giờ                                | `password-reset.test.ts` (gồm 20 lượt đoán song song)    |

## Phân quyền

| Yêu cầu                                  | Triển khai                                            | Kiểm tra                                                  |
| ---------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| Khách không vào được admin               | `requireRole('ADMIN')` trên toàn bộ `/api/admin`      | `security.test.ts` **tự dò mọi route** trong router admin |
| Khách không xem/sửa được khách khác      | API khách hàng không có tham số `:id` — chỉ `/api/me` | `security.test.ts`, thử thực tế (IDOR)                    |
| Khách không đổi được ảnh, vai trò, email | Không có route; trường thừa bị zod loại bỏ            | `customers.test.ts`, `avatar.test.ts`                     |
| Người lạ không vào được API              | 401 cho mọi route cần đăng nhập                       | `security.test.ts` (tự dò route)                          |

## Tấn công web

| Yêu cầu        | Triển khai                                                                                                                      | Kiểm tra                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| CSRF           | `SameSite=Strict` + kiểm tra `Origin` + double-submit token cho **mọi** POST/PUT/PATCH/DELETE                                   | `security.test.ts` **tự dò mọi route ghi dữ liệu**                                                                                |
| CORS           | Chỉ `APP_ORIGIN`, có credentials                                                                                                | `security.test.ts`                                                                                                                |
| SQL injection  | Drizzle (truy vấn tham số hóa); `LIKE` escape ký tự đại diện                                                                    | `security.test.ts`, thử thực tế                                                                                                   |
| XSS            | React tự escape; không dùng `innerHTML`/`eval`; CSP chặt trên bản build (`script-src 'self'`); API gửi CSP `default-src 'none'` | Trình duyệt thật: payload `<img onerror>`, `<script>`, `<svg onload>` hiển thị thành chữ trên 6 trang, 0 hộp thoại, 0 vi phạm CSP |
| Clickjacking   | API: `frame-ancestors 'none'`. Frontend: cần header `frame-ancestors` ở máy chủ web (xem `docs/deployment.md`)                  | `security.test.ts`                                                                                                                |
| Header bảo mật | helmet: HSTS, nosniff, `Referrer-Policy: no-referrer`, CORP same-origin, ẩn `X-Powered-By`                                      | `security.test.ts`                                                                                                                |
| Input độc hại  | Ký tự NUL → 400; URL mã hóa sai → 400; tham số lặp → 400; body ≤ 100 KB; body không phải JSON → 400; khóa `__proto__` bị bỏ     | `security.test.ts`                                                                                                                |
| Rate limit     | Theo IP cho đăng nhập, refresh, OTP, QR công khai, toàn API; `X-Forwarded-For` không được tin khi `TRUST_PROXY=0`               | `auth.test.ts`, `public-qr.test.ts`, `password-reset.test.ts`, `security.test.ts`                                                 |

## Tệp tải lên

| Yêu cầu                 | Triển khai                                                                       | Kiểm tra         |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------- |
| Không tin MIME/tên file | Giải mã ảnh bằng sharp để xác định định dạng; tên file do server sinh ngẫu nhiên | `avatar.test.ts` |
| Giới hạn                | ≤ 5 MB, 1 file, ≥ 64×64, ≤ 40 MP (chống "bom giải nén"); SVG bị từ chối          | `avatar.test.ts` |
| Riêng tư                | Mã hóa lại WebP 512×512 → xóa EXIF/GPS                                           | `avatar.test.ts` |
| Path traversal          | Key chỉ do server sinh + kiểm tra mẫu + kiểm tra đường dẫn                       | `avatar.test.ts` |

## Riêng tư & QR công khai

| Yêu cầu                          | Triển khai                                            | Kiểm tra                                              |
| -------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| QR không chứa dữ liệu cá nhân    | Chỉ URL + token 128-bit ngẫu nhiên                    | `qr.test.ts` giải mã ngược ảnh QR                     |
| Whitelist trường công khai       | `PublicProfile` dựng từng trường                      | `public-qr.test.ts` (so khớp chính xác danh sách key) |
| QR cũ/bị khóa không lộ thông tin | Kiểm tra QR `ACTIVE` + tài khoản `ACTIVE` + đã đồng ý | `public-qr.test.ts`, thử thực tế                      |
| Không phân biệt lý do lỗi        | Một response 404 duy nhất                             | `public-qr.test.ts`                                   |
| Không bị index / cache           | `noindex`, `X-Robots-Tag`, `no-store`, `no-referrer`  | `public-qr.test.ts`                                   |
| Đồng ý công khai                 | Bắt buộc khi tạo; không có đồng ý → không hiển thị    | `customers.test.ts`, `public-qr.test.ts`              |

## Log & bí mật

| Yêu cầu                       | Triển khai                                                                                                          | Kiểm tra                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Không log mật khẩu/OTP/cookie | Log HTTP chỉ ghi method + URL (token QR bị che, bỏ query string); redact các khóa nhạy cảm                          | Quét 3.100+ dòng log thực: 0 mật khẩu, 0 cookie, 0 token QR, 0 hash |
| Lỗi DB không lộ dữ liệu       | Serializer riêng bỏ tham số query và `detail` của PostgreSQL                                                        | `security.test.ts`                                                  |
| Không lộ stack trace          | Lỗi bất ngờ → 500 với thông điệp chung                                                                              | `health.test.ts`, `security.test.ts`                                |
| Không commit bí mật           | `.env` trong `.gitignore`; chỉ `.env.example`                                                                       | Kiểm tra `git ls-files`                                             |
| Cấu hình production an toàn   | Server **từ chối khởi động** nếu: secret là placeholder/ngắn, provider OTP là `console`, QR domain không phải https | `security.test.ts`                                                  |
| Audit log không chứa PII      | Chỉ tên trường, trạng thái, id nội bộ                                                                               | `customers.test.ts`, `qr.test.ts`                                   |
| Dependency                    | `npm audit --omit=dev`: 0 lỗ hổng                                                                                   | M10                                                                 |

## Rủi ro còn lại / cần làm khi triển khai

1. **Rate limit lưu trong bộ nhớ** — đúng khi chạy **một** tiến trình API. Chạy nhiều instance cần store chung (Redis) — sẽ hỏi trước khi thêm.
2. **Khóa tài khoản có thể bị lạm dụng**: kẻ xấu biết email/SĐT có thể cố ý nhập sai 5 lần để khóa tài khoản 15 phút. Đây là đánh đổi chuẩn để chống dò mật khẩu; khách hàng vẫn tự mở khóa được bằng "Quên mật khẩu".
3. **Header cho frontend** (`frame-ancestors`, HSTS) phải được cấu hình ở máy chủ web/reverse proxy — mẫu cấu hình nằm trong `docs/deployment.md` (Milestone 12).
4. **Admin chưa có xác thực 2 lớp (2FA)** — không có trong spec. Khuyến nghị cân nhắc cho tài khoản admin trong tương lai.
5. **Nhà cung cấp SMS** chưa chọn (`SMS_PROVIDER=disabled` ở production → khôi phục qua SMS báo "chưa hỗ trợ").
6. **Sao lưu**: database và thư mục `backend/storage` chứa dữ liệu cá nhân — bản sao lưu phải được mã hóa và giới hạn quyền truy cập.
