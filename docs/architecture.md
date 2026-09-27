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

## Mã QR (Milestone 6)

```text
Tạo khách hàng ──► [transaction] users + customer_profiles + qr_codes(ACTIVE) + audit
Tạo lại        ──► [transaction, khóa dòng users của khách] ACTIVE → REVOKED, tạo ACTIVE mới
Thu hồi        ──► [transaction, khóa dòng users của khách] ACTIVE → REVOKED
Ảnh QR         ──► sinh khi được yêu cầu từ token hiện tại (không lưu file)
```

- **Token**: `crypto.randomBytes(16)` → base64url (22 ký tự, 128-bit). Không suy ra từ id, SĐT, ngày sinh. 128-bit giữ QR đủ thưa để quét tốt trên vải mà vẫn không thể đoán.
- **Nội dung QR** chỉ là URL `PUBLIC_QR_BASE_URL/qr/<token>` — test giải mã ngược ảnh PNG để khẳng định không có tên/SĐT/ngày sinh.
- **Tối đa một mã ACTIVE / khách**: partial unique index trong DB + khóa dòng khách hàng khi đổi mã. Khóa riêng dòng QR là **không đủ**: transaction chờ sẽ thấy dòng đó đã bị thu hồi, tưởng "chưa có mã" rồi tạo thêm — lỗi này được phát hiện bằng test tạo lại đồng thời.
- **Hạn chế lộ token**: chỉ mã ACTIVE trả `url` đầy đủ; lịch sử chỉ có 4 ký tự cuối (`tokenHint`). Audit log chỉ ghi id nội bộ của mã. Log HTTP che `/qr/<token>`.
- **`PUBLIC_QR_BASE_URL` bắt buộc (https) ở production** — server từ chối khởi động nếu thiếu. Domain này in vĩnh viễn lên áo.
- **In ấn**: trang quản lý QR có nút "In" với bố cục in riêng (chỉ QR 9cm + tên), luôn in màu sáng.

## Trang QR công khai (Milestone 7)

```text
Người quét ──► /qr/<token> (SPA, không cần đăng nhập)
               └► GET /api/qr/<token>
                  ├ token sai định dạng ─────────────────────────┐
                  └► JOIN qr_codes ⋈ users ⋈ customer_profiles    │
                     WHERE qr.status = ACTIVE                     ├─► 404 QR_NOT_FOUND (giống hệt nhau)
                       AND users.role = CUSTOMER                  │
                       AND users.status = ACTIVE                  │
                       AND public_consent_at IS NOT NULL ── không có dòng ┘
                     └► whitelist 10 trường → 200
```

- **Whitelist tường minh**: `PublicProfile` trong `shared` và hàm dựng copy từng trường theo tên. Test khẳng định danh sách key chính xác và không có email/SĐT đăng nhập/id.
- **Không phân biệt lý do lỗi**: người quét không biết mã có tồn tại, bị thu hồi hay tài khoản bị khóa.
- **Không đọc cookie/phiên** ở các route công khai — người đang đăng nhập cũng chỉ là khách vãng lai ở đây.
- **Trang tối giản** theo spec: không đăng nhập, không điều hướng, không tìm kiếm. Liên kết duy nhất là SĐT gia đình dạng `tel:` (bấm để gọi trên điện thoại). Khi mã không hiển thị được, trang gợi ý số khẩn cấp 115/113 để người muốn giúp không bị bế tắc.
- **Tải nhanh**: các trang admin/khách hàng được tải theo route (lazy); `shared` khai báo `"sideEffects": false` để zod không nằm trong gói tải ban đầu. Trang công khai tải ~93 KB gzip (trước tối ưu ~168 KB).
- **Tiêu đề tab chung** ("Thông tin hỗ trợ") — tên chủ áo không lọt vào lịch sử trình duyệt đồng bộ.

## Giao diện & khả năng truy cập (Milestone 9)

- **Theme**: sáng / tối / theo hệ thống, bằng token màu ngữ nghĩa (`bg-surface`, `text-fg-muted`…) nên mọi component tự hỗ trợ dark mode. `public/theme-init.js` áp theme trước khi React chạy (không nháy màu). In ấn luôn dùng bảng màu sáng.
- **Kiểm tra truy cập tự động**: `frontend/tests/a11y.test.tsx` chạy axe-core (WCAG 2.0/2.1/2.2 A–AA + best-practice) trên 9 màn hình chính ở mỗi lần `npm test`. Độ tương phản màu không đo được trong jsdom nên được kiểm tra thủ công bằng axe trong trình duyệt thật ở cả hai theme — không có vi phạm.
- **Trình đọc màn hình**: nhãn gắn với ô nhập, lỗi liên kết bằng `aria-describedby`, `aria-invalid`; hộp thoại dùng `<dialog>` gốc (bẫy focus, Esc); link "Bỏ qua điều hướng"; mỗi lần chuyển trang, vùng `aria-live` đọc tên trang mới; bảng có `<caption>`.
- **Bàn phím**: viền focus rõ ở mọi phần tử; menu di động đóng bằng Esc và trả focus về nút menu.
- **Trạng thái**: mỗi trang có trạng thái đang tải, rỗng, lỗi (kèm "Thử lại"). Lỗi bất ngờ khi render hiển thị trang lỗi thân thiện; riêng lỗi "file JS cũ không còn" sau khi deploy bản mới được nhận diện và gợi ý tải lại trang.
- **Phiên hết hạn**: người đang đăng nhập bị chuyển về trang đăng nhập kèm lời giải thích (hết hạn / tài khoản bị vô hiệu hóa).

## Khôi phục mật khẩu (Milestone 8)

```text
1. POST /auth/forgot-password {identifier}
   └► kênh = email → EMAIL | SĐT → SMS (kênh tắt → 503, giống nhau cho mọi tài khoản)
   └► tài khoản không phải khách hàng đang hoạt động / trong 60s cooldown / quá 5 mã/giờ
      → dừng im lặng; mọi trường hợp đều trả {accepted: true}
   └► đóng mọi OTP cũ → lưu HMAC(OTP_SECRET, userId:code) → gửi ở nền (không chờ)
2. POST /auth/verify-otp {identifier, otp}
   └► trừ 1 lượt thử (atomic, chỉ khi còn lượt) → so sánh constant-time
   └► đúng → reset token 256-bit (lưu SHA-256, 15 phút)
3. POST /auth/reset-password {resetToken, newPassword}
   └► [transaction] tiêu thụ token (1 lần) → đổi mật khẩu → thu hồi mọi phiên → đóng OTP → audit
```

- **HMAC có khóa** thay vì hash thường: chỉ có 1 triệu mã 6 số, hash thường bị dò ngược ngay nếu lộ bảng; HMAC với `OTP_SECRET` thì không.
- **Trừ lượt thử trước khi so sánh** (một câu `UPDATE ... WHERE attempt_count < 5 RETURNING`) — test gửi 20 lượt đoán song song, số lượt dừng đúng ở 5.
- **Gửi ở nền** để thời gian phản hồi không cho biết tài khoản có tồn tại. Lỗi gửi được ghi log (không kèm mã).
- **Provider**: `EmailProvider` (`console` / `smtp` qua nodemailer / `disabled`), `SmsProvider` (`console` / `disabled`). `console` in mã ra log để test ở máy dev và **bị từ chối khi `NODE_ENV=production`**. Nhà cung cấp SMS thật chưa được chọn — thêm một class `SmsProvider` khi quyết định (sẽ hỏi trước vì có chi phí và cần đăng ký brandname).
- **Reset token chỉ đi qua state của router**, không bao giờ nằm trên URL; trang đặt lại mật khẩu xóa nó khỏi lịch sử ngay khi đọc.
- Bản ghi OTP cũ hơn 24 giờ của một tài khoản được xóa mỗi khi tài khoản đó yêu cầu mã mới.
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
