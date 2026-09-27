# QR Care API

Base path: `/api`. Mọi response là JSON:

```json
{ "success": true, "data": { ... } }
{ "success": false, "code": "INVALID_CREDENTIALS", "message": "...", "details": [ ... ] }
```

- `code` ổn định để frontend hiển thị thông báo tiếng Việt; `message` là tiếng Anh cho developer.
- Lỗi validate: `400 VALIDATION_ERROR`, `details` là danh sách `{ path, message }` theo từng trường.
- Request thay đổi dữ liệu (POST/PUT/PATCH/DELETE) phải có header `X-CSRF-Token` bằng giá trị cookie `qrc_csrf` (lấy qua `GET /api/auth/csrf`).
- Mọi response có `Cache-Control: no-store`.

## Xác thực — `/api/auth`

| Method | Path               | Quyền          | Mô tả                                                                                                    |
| ------ | ------------------ | -------------- | -------------------------------------------------------------------------------------------------------- |
| GET    | `/csrf`            | Công khai      | Đặt cookie `qrc_csrf`, trả `{ csrfToken }`                                                               |
| POST   | `/login`           | Công khai      | `{ identifier, password }` — identifier là email hoặc SĐT. Đặt cookie phiên                              |
| POST   | `/refresh`         | Cookie refresh | Xoay vòng refresh token, cấp access token mới                                                            |
| POST   | `/logout`          | Công khai      | Thu hồi phiên hiện tại, xóa cookie                                                                       |
| GET    | `/me`              | Đã đăng nhập   | `{ user }` — cho phép cả khi đang phải đổi mật khẩu                                                      |
| POST   | `/change-password` | Đã đăng nhập   | `{ currentPassword, newPassword }` — thu hồi mọi phiên khác                                              |
| POST   | `/forgot-password` | Công khai      | `{ identifier }` — gửi OTP qua email (nếu là email) hoặc SMS (nếu là SĐT). Luôn trả `{ accepted: true }` |
| POST   | `/verify-otp`      | Công khai      | `{ identifier, otp }` → `{ resetToken }` (hết hạn sau 15 phút, dùng 1 lần)                               |
| POST   | `/reset-password`  | Công khai      | `{ resetToken, newPassword }` — đặt mật khẩu, thu hồi mọi phiên                                          |

Khôi phục mật khẩu: chỉ tài khoản khách hàng đang hoạt động nhận được mã (admin dùng CLI). `forgot-password` trả **cùng một** response dù tài khoản có tồn tại hay không. OTP 6 số, hết hạn 10 phút, tối đa 5 lần nhập, gửi lại sau 60 giây, tối đa 5 mã/giờ/tài khoản; giới hạn IP 5 yêu cầu gửi mã và 20 lần xác nhận / 15 phút. Lỗi: `OTP_INVALID` (400, chung cho sai/hết hạn/hết lượt), `RESET_TOKEN_INVALID` (400), `EMAIL_UNAVAILABLE` / `SMS_UNAVAILABLE` (503 khi kênh bị tắt trong cấu hình).

Mã lỗi: `INVALID_CREDENTIALS` (401), `ACCOUNT_LOCKED` (423, `details.retryAfterSeconds`), `ACCOUNT_INACTIVE` (403 khi đăng nhập / 401 khi đang dùng), `UNAUTHENTICATED` (401), `SESSION_EXPIRED` (401), `REFRESH_CONFLICT` (409), `INVALID_CURRENT_PASSWORD` (400), `PASSWORD_CHANGE_REQUIRED` (403), `RATE_LIMITED` (429).

## Admin — `/api/admin` (vai trò ADMIN, đã đổi mật khẩu mặc định)

| Method | Path                        | Mô tả                                                                                            |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------ |
| GET    | `/dashboard`                | `{ stats, recentCustomers }`                                                                     |
| GET    | `/users`                    | Danh sách khách hàng. Query: `search`, `status` (`ACTIVE`/`INACTIVE`), `page`, `pageSize` (≤100) |
| POST   | `/users`                    | Tạo khách hàng + hồ sơ. Trả `{ customer, temporaryPassword }` (mật khẩu tạm chỉ trả **một lần**) |
| GET    | `/users/:id`                | `{ customer }` — chi tiết: `profile`, `account`, trạng thái                                      |
| PUT    | `/users/:id`                | Cập nhật hồ sơ + email/SĐT đăng nhập                                                             |
| PATCH  | `/users/:id/status`         | `{ status }` — vô hiệu hóa sẽ đăng xuất khách hàng ngay                                          |
| POST   | `/users/:id/reset-password` | Cấp mật khẩu tạm mới `{ temporaryPassword }`, bắt đổi khi đăng nhập                              |

| GET | `/users/:id/avatar` | Ảnh đại diện (`image/webp`), 404 `AVATAR_NOT_FOUND` nếu chưa có |
| PUT | `/users/:id/avatar` | Tải/đổi ảnh: `multipart/form-data`, **một** file trong trường `avatar`, tối đa 5 MB |
| DELETE | `/users/:id/avatar` | Xóa ảnh |
| GET | `/users/:id/qr` | `{ current, history }` — mã hiện tại (có `url`) và lịch sử (chỉ `tokenHint`) |
| POST | `/users/:id/qr` | Tạo mã mới khi chưa có mã đang hoạt động (`409 QR_ALREADY_ACTIVE` nếu đã có) |
| POST | `/users/:id/qr/regenerate` | Thu hồi mã hiện tại và tạo mã mới (một transaction) |
| POST | `/users/:id/qr/revoke` | Thu hồi mã hiện tại, không tạo mã mới (`404 QR_NOT_FOUND` nếu không có) |
| GET | `/users/:id/qr/image` | Ảnh mã hiện tại. Query: `format=png\|svg` (mặc định png), `download=1` để tải về |

- Tạo khách hàng (`POST /users`) **tự động** tạo mã QR đầu tiên trong cùng transaction.
- Mã QR chỉ chứa `PUBLIC_QR_BASE_URL/qr/<token>` — token 128-bit ngẫu nhiên, 22 ký tự base64url. Không chứa thông tin cá nhân.
- PNG 1024px, SVG vector; mức sửa lỗi Q (chịu ~25% hư hại), lề 4 ô.

- Ảnh: chỉ nhận JPEG/PNG/WebP (xác định bằng cách giải mã, không tin MIME type), tối thiểu 64×64. Lỗi: `INVALID_IMAGE`, `IMAGE_TOO_SMALL` (400), `FILE_TOO_LARGE` (413), `FILE_REQUIRED` / `INVALID_UPLOAD` (400). Ảnh được lưu lại dạng WebP 512×512, không còn metadata.
- `profile.avatarVersion` đổi mỗi khi đổi ảnh — gắn vào URL ảnh (`?v=`) để trình duyệt không dùng ảnh cũ.
- Tìm kiếm khớp tên (không phân biệt dấu: `nguyen` → "Nguyễn"), email, hoặc SĐT (gõ `0912…` hay `+84912…` đều được).
- `id` không hợp lệ / không phải khách hàng → `404 CUSTOMER_NOT_FOUND`.
- Email/SĐT trùng → `409 EMAIL_TAKEN` / `PHONE_TAKEN` kèm `details` theo trường.
- Mỗi thao tác ghi `audit_logs` (chỉ tên trường thay đổi, không ghi giá trị).

Body tạo khách hàng:

```json
{
  "fullName": "Nguyễn Văn A",
  "dateOfBirth": "2006-03-19",
  "gender": "MALE",
  "address": "12 Lê Lợi, Quận 1",
  "familyPhone": "0987 654 321",
  "bloodGroup": "O+",
  "weightKg": "60,5",
  "heightCm": 170,
  "email": "khach@example.com",
  "phone": "0912 345 678",
  "password": "",
  "publicConsent": true
}
```

`password` rỗng → hệ thống tự sinh. Tuổi **không** nhận từ client — luôn tính từ `dateOfBirth`.

## Trang QR công khai — `/api/qr` (không cần đăng nhập)

| Method | Path             | Mô tả                                                   |
| ------ | ---------------- | ------------------------------------------------------- |
| GET    | `/:token`        | `{ profile }` — chỉ các trường công khai (xem bên dưới) |
| GET    | `/:token/avatar` | Ảnh đại diện (`image/webp`)                             |

`profile` có **đúng** các trường: `fullName`, `dateOfBirth`, `age`, `gender`, `address`, `familyPhone`, `bloodGroup`, `weightKg`, `heightCm`, `avatarUrl`. Không có id, email/SĐT đăng nhập, trạng thái tài khoản hay bất kỳ trường nào khác.

Hiển thị khi và chỉ khi: mã QR `ACTIVE` **và** tài khoản khách hàng `ACTIVE` **và** đã có đồng ý công khai. Mọi trường hợp khác (token sai định dạng, không tồn tại, đã thu hồi, tài khoản bị vô hiệu hóa) trả **cùng một** response:

```json
{ "success": false, "code": "QR_NOT_FOUND", "message": "QR code is invalid or has been revoked" }
```

Header: `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`. Giới hạn 60 request/phút/IP. Không có endpoint liệt kê hay tìm kiếm.

## Khách hàng — `/api/me` (vai trò CUSTOMER, đã đổi mật khẩu mặc định)

| Method | Path       | Mô tả                                                                                  |
| ------ | ---------- | -------------------------------------------------------------------------------------- |
| GET    | `/profile` | `{ account: { email, phone }, profile }`                                               |
| PUT    | `/profile` | Sửa họ tên, ngày sinh, giới tính, địa chỉ, SĐT gia đình, nhóm máu, cân nặng, chiều cao |
| GET    | `/avatar`  | Ảnh đại diện của chính mình (chỉ xem — khách hàng không có API tải/đổi ảnh)            |

Không có tham số `:id` — khách hàng chỉ truy cập được dữ liệu của chính mình. Các trường khác gửi lên (email, role, avatar, tuổi…) bị bỏ qua.
