# Kiến trúc QR Care

Tài liệu này ghi lại kiến trúc và các quyết định đã được duyệt ở Milestone 0. Khi một quyết định thay đổi, cập nhật tại đây kèm lý do.

## Tổng quan

```text
Browser ──► Frontend (React SPA)  ─┐   cùng domain: /api được reverse-proxy tới backend
                                   ├─► Backend (Express 5 + TypeScript) ──► PostgreSQL
Dev: Vite proxy /api → :4000      ─┘         ├─► StorageProvider (Local, S3-compatible sau này)
                                             ├─► EmailProvider   (Console | SMTP)
                                             └─► SmsProvider     (Console | chưa chọn)
```

- **Monorepo npm workspaces**: `shared` (enum + zod schema dùng chung), `backend`, `frontend`.
- **Cùng origin**: frontend và API phục vụ trên cùng domain. Nhờ vậy cookie dùng được `SameSite=Strict` và không cần CORS cho trình duyệt. Ở môi trường dev, Vite proxy `/api` để tái hiện điều này.

## Quyết định đã duyệt

| #   | Quyết định                                                                                                                                         | Lý do                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Q1  | PostgreSQL chạy local qua Docker (`docker-compose.yml` chỉ có DB). Có thể cài native thay thế.                                                     | Máy dev đã có Docker. DB test tách biệt dễ dàng.      |
| Q2  | Drizzle ORM + drizzle-kit (migration SQL).                                                                                                         | Nhẹ, type-safe, gần SQL, hỗ trợ partial unique index. |
| Q3  | Mật khẩu mặc định **tự sinh ngẫu nhiên** cho từng khách, hiển thị cho admin đúng một lần (admin có thể tự nhập). Bắt buộc đổi ở lần đăng nhập đầu. | Tránh mật khẩu chung dễ đoán.                         |
| Q4  | Tài khoản khách cần **ít nhất một** trong email / SĐT. SĐT: số Việt Nam, lưu dạng E.164 `+84…`.                                                    | Người khuyết tật / người già có thể không có email.   |

## Mặc định đã chốt

- UI tiếng Việt. API trả `code` + `message` tiếng Anh; frontend dịch theo `code`.
- Gender: `MALE | FEMALE | OTHER`. Blood group: 8 nhóm + `UNKNOWN`.
- Trường bắt buộc: họ tên, ngày sinh, giới tính, SĐT gia đình.
- Tuổi luôn tính từ ngày sinh theo múi giờ `Asia/Ho_Chi_Minh`, không lưu trong DB.
- Không có hard-delete: `PATCH /api/admin/users/:id/status` thay cho `DELETE`.
- Admin quên mật khẩu: reset bằng CLI script (không qua SMS, tránh SIM-swap).

## Rủi ro và biện pháp

| Rủi ro                                       | Biện pháp                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Domain trong QR đã in lên áo là vĩnh viễn    | `PUBLIC_QR_BASE_URL` cấu hình riêng; phải chốt domain lâu dài trước khi in áo thật.             |
| Token QR lộ qua Referer / log                | `Referrer-Policy: no-referrer`, `<meta name="referrer">`, log che `/qr/<token>`.                |
| JWT còn hạn sau khi khóa tài khoản           | Middleware kiểm tra `status` trong DB mỗi request; khóa/đổi mật khẩu thu hồi mọi refresh token. |
| Dò tài khoản qua quên mật khẩu               | Luôn trả cùng một thông báo.                                                                    |
| Dò trạng thái QR                             | QR sai / bị thu hồi / chủ bị khóa đều trả cùng một 404.                                         |
| EXIF (GPS) trong ảnh                         | Decode + re-encode WebP 512px, loại bỏ metadata.                                                |
| Avatar còn truy cập được sau thu hồi QR      | Avatar công khai chỉ phục vụ qua `/api/qr/:token/avatar`.                                       |
| Rate limit in-memory chỉ đúng với 1 instance | Chấp nhận hiện tại; scale nhiều instance cần Redis (sẽ hỏi trước).                              |
| SMS VN cần brandname, có phí                 | Provider abstraction; provider thật chọn sau.                                                   |
| Thông tin cá nhân hiển thị công khai         | Admin xác nhận khách đồng ý công khai khi tạo; lưu `public_consent_at`.                         |

## Bảo mật xác thực

- Access JWT 15 phút + refresh token 7 ngày, xoay vòng, lưu **hash** trong DB. Refresh token cũ bị dùng lại → thu hồi cả family.
- Cookie `HttpOnly`, `Secure` (production), `SameSite=Strict`. CSRF double-submit token cho request thay đổi dữ liệu.
- Mật khẩu hash bằng Argon2id. Khóa tạm thời khi đăng nhập sai nhiều lần.
- OTP 6 số (`crypto.randomInt`), lưu HMAC-SHA256, hết hạn 10 phút, tối đa 5 lần thử, gửi lại sau 60 giây. Xác thực OTP xong → cấp reset token ngắn hạn.
- QR token: 128-bit `crypto.randomBytes` → base64url (22 ký tự). QR in ECC mức Q.

## Database (dự kiến, chi tiết ở Milestone 2)

```text
users              id, role, status, email?, phone?, CHECK(email OR phone), password_hash,
                   must_change_password, failed_login_count, locked_until,
                   password_changed_at, last_login_at, created_at, updated_at
customer_profiles  user_id PK/FK, full_name, date_of_birth, gender, address, family_phone,
                   blood_group, weight_kg, height_cm, avatar_key, public_consent_at, timestamps
qr_codes           id, user_id, token UNIQUE, status, created_by, created_at, revoked_by,
                   revoked_at; UNIQUE(user_id) WHERE status = 'ACTIVE'
refresh_tokens     id, user_id, family_id, token_hash UNIQUE, expires_at, revoked_at,
                   replaced_by, created_at
otp_verifications  id, user_id, channel, purpose, otp_hash, expires_at, attempt_count,
                   verified_at, reset_token_hash, consumed_at, created_at
audit_logs         id, actor_user_id, action, target_user_id, metadata (không PII), created_at
```
