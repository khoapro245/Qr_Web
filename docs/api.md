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

| Method | Path               | Quyền          | Mô tả                                                                       |
| ------ | ------------------ | -------------- | --------------------------------------------------------------------------- |
| GET    | `/csrf`            | Công khai      | Đặt cookie `qrc_csrf`, trả `{ csrfToken }`                                  |
| POST   | `/login`           | Công khai      | `{ identifier, password }` — identifier là email hoặc SĐT. Đặt cookie phiên |
| POST   | `/refresh`         | Cookie refresh | Xoay vòng refresh token, cấp access token mới                               |
| POST   | `/logout`          | Công khai      | Thu hồi phiên hiện tại, xóa cookie                                          |
| GET    | `/me`              | Đã đăng nhập   | `{ user }` — cho phép cả khi đang phải đổi mật khẩu                         |
| POST   | `/change-password` | Đã đăng nhập   | `{ currentPassword, newPassword }` — thu hồi mọi phiên khác                 |

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

## Khách hàng — `/api/me` (vai trò CUSTOMER, đã đổi mật khẩu mặc định)

| Method | Path       | Mô tả                                                                                  |
| ------ | ---------- | -------------------------------------------------------------------------------------- |
| GET    | `/profile` | `{ account: { email, phone }, profile }`                                               |
| PUT    | `/profile` | Sửa họ tên, ngày sinh, giới tính, địa chỉ, SĐT gia đình, nhóm máu, cân nặng, chiều cao |

Không có tham số `:id` — khách hàng chỉ truy cập được dữ liệu của chính mình. Các trường khác gửi lên (email, role, avatar, tuổi…) bị bỏ qua.
