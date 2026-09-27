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

### Phiên đăng nhập (đã triển khai — Milestone 3)

| Cookie     | Nội dung                                   | Thuộc tính                                                 |
| ---------- | ------------------------------------------ | ---------------------------------------------------------- |
| `qrc_at`   | Access JWT (HS256), sống 15 phút           | `HttpOnly`, `SameSite=Strict`, `Path=/api`, `Secure`*      |
| `qrc_rt`   | Refresh token ngẫu nhiên 256-bit, 7 ngày   | `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Secure`* |
| `qrc_csrf` | CSRF token (SPA đọc và gửi lại qua header) | `SameSite=Strict`, `Path=/`, `Secure`*                     |

\* `Secure` bật mặc định khi `NODE_ENV=production` (ghi đè bằng `COOKIE_SECURE`).

- **JWT chỉ chứa** `sub` (user id), `role`, `sid` (session family). Không có thông tin cá nhân.
- **Refresh token là chuỗi ngẫu nhiên, không phải JWT**, DB chỉ lưu SHA-256 của nó → không cần `JWT_REFRESH_SECRET` như gợi ý ban đầu trong spec.
- **Xoay vòng**: mỗi lần refresh cấp token mới trong cùng family và thu hồi token cũ. Token cũ bị dùng lại sau 30 giây → coi là bị đánh cắp, thu hồi cả family. Trong 30 giây → coi là 2 tab refresh cùng lúc, trả `409 REFRESH_CONFLICT` để client thử lại.
- **Kiểm tra DB mỗi request**: middleware `authenticate` xác minh JWT rồi kiểm tra user còn `ACTIVE`, session family còn sống, và token được cấp sau lần đổi mật khẩu gần nhất. Vai trò lấy từ DB, không tin vào token. → Đăng xuất, khóa tài khoản, đổi mật khẩu có hiệu lực **ngay lập tức**.
- **Đổi mật khẩu** thu hồi mọi phiên khác và cấp phiên mới cho thiết bị hiện tại.
- **Bắt buộc đổi mật khẩu mặc định**: khi `must_change_password = true`, mọi API ngoài `/auth/me`, `/auth/change-password`, `/auth/logout` trả `403 PASSWORD_CHANGE_REQUIRED`.

### Chống tấn công

- **CSRF**: cookie `SameSite=Strict` + kiểm tra header `Origin` (nếu có) phải bằng `APP_ORIGIN` + double-submit token (`X-CSRF-Token` phải khớp cookie `qrc_csrf`) cho mọi POST/PUT/PATCH/DELETE, kể cả đăng nhập.
- **Dò mật khẩu**: sau 5 lần sai liên tiếp, tài khoản bị khóa 15 phút (lưu trong DB, áp dụng cho mọi IP). Thêm giới hạn theo IP: đăng nhập 20 lần / 15 phút, refresh 120 / 15 phút, đổi mật khẩu 10 / 15 phút, toàn API 300 / phút.
- **Dò tài khoản**: "không có tài khoản" và "sai mật khẩu" trả **cùng một** lỗi `INVALID_CREDENTIALS`, và server vẫn chạy Argon2 với hash giả để thời gian phản hồi như nhau. _Khác với ví dụ thông báo trong spec §29 ("Invalid email or phone." / "Password is incorrect.") — tách hai thông báo sẽ giúp kẻ tấn công biết email/SĐT nào đã đăng ký._ Trạng thái "đã vô hiệu hóa" chỉ được báo sau khi mật khẩu đúng.
- **Mật khẩu**: Argon2id (19 MiB, 2 vòng — mức tối thiểu OWASP). Mật khẩu mới: 8–128 ký tự, có chữ và số.
- Mọi response `/api` có `Cache-Control: no-store`.

## Quản lý khách hàng (Milestone 4)

- Mọi response được dựng **từng trường một** qua hàm mapper (`toProfileView`, `toDetail`…) — không bao giờ trả nguyên đối tượng DB, nên cột mới trong DB không thể vô tình lộ ra API.
- Tuổi luôn tính từ ngày sinh theo lịch Việt Nam (`calculateAge` trong `shared`), cả backend lẫn frontend dùng chung một hàm.
- Tìm kiếm tên không phân biệt dấu dùng extension `unaccent` có sẵn của PostgreSQL (migration `0001_enable_unaccent.sql`). Đây là extension "trusted" nên chủ database bật được mà không cần superuser; các dịch vụ PostgreSQL cloud phổ biến đều hỗ trợ.
- Không xóa cứng: vô hiệu hóa (`INACTIVE`) thay cho xóa — thu hồi mọi phiên, chặn đăng nhập, QR ngừng hiển thị.
- `audit_logs` ghi: tạo, sửa (chỉ **tên** trường thay đổi), đổi trạng thái (`from`/`to`), cấp lại mật khẩu, khách tự sửa hồ sơ.
- Mật khẩu tạm chỉ xuất hiện trong response tạo/cấp lại và trên màn hình admin **một lần** (trang chi tiết xóa nó khỏi lịch sử trình duyệt ngay sau khi đọc).

## Ảnh đại diện (Milestone 5)

```text
Admin chọn ảnh ──► multer (bộ nhớ, ≤ 5 MB, đúng 1 file "avatar")
                   └► sharp: giải mã → kiểm tra định dạng thật (JPEG/PNG/WebP) & kích thước (≥ 64px, ≤ 40MP)
                      └► xoay theo EXIF → cắt vuông 512×512 → WebP → (metadata bị loại bỏ)
                         └► StorageProvider.put("avatars/<random>.webp")
                            └► DB: customer_profiles.avatar_key = key  (ảnh cũ xóa sau khi DB cập nhật)
```

- **Chỉ admin** có API tải/đổi/xóa ảnh. Khách hàng chỉ có `GET /api/me/avatar`.
- **Không tin client**: MIME type, tên file đều bị bỏ qua; định dạng xác định bằng cách giải mã. SVG bị từ chối. Tên file do server sinh ngẫu nhiên (144-bit).
- **Riêng tư**: ảnh chụp điện thoại thường chứa EXIF (tọa độ GPS, model máy) — mã hóa lại sẽ xóa hết.
- **Lưu trữ tách biệt** qua interface `StorageProvider` (`put/get/delete` theo key). Hiện có `LocalDiskStorage` (thư mục `backend/storage`, cần sao lưu cùng DB). Thêm S3-compatible sau này chỉ là thêm một class — sẽ hỏi trước vì cần thêm dependency (SDK).
- **Ảnh không có URL công khai cố định**: admin xem qua `/api/admin/users/:id/avatar`, khách qua `/api/me/avatar`, trang QR công khai (Milestone 7) qua `/api/qr/:token/avatar` — thu hồi QR là ảnh cũng không truy cập được nữa.

### Chưa triển khai

- OTP 6 số (`crypto.randomInt`), lưu HMAC-SHA256, hết hạn 10 phút, tối đa 5 lần thử, gửi lại sau 60 giây. Xác thực OTP xong → cấp reset token ngắn hạn. _(Milestone 8)_
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
