# Vận hành QR Care

Dành cho người quản trị máy chủ sau khi đã triển khai theo [deployment.md](deployment.md). Các lệnh dùng alias:

```bash
alias qrc='sudo docker compose --env-file /opt/qrcare/deploy/production.env -f /opt/qrcare/deploy/compose.yml'
```

## Việc định kỳ

| Tần suất   | Việc                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| Tự động    | Sao lưu hằng đêm (cron), dọn phiên/OTP hết hạn mỗi 6 giờ (app tự làm), xoay vòng log          |
| Hằng tuần  | Xem log lỗi và cảnh báo (mục [Log](#log)); kiểm tra bản sao lưu mới nhất có dung lượng hợp lý |
| Hằng tháng | Cập nhật image nền và dependency (mục [Cập nhật](#cập-nhật-bảo-mật)); xem audit log admin     |
| Hằng quý   | **Thử khôi phục** một bản sao lưu (mục [Thử khôi phục](#thử-khôi-phục-định-kỳ))               |

## Giám sát

- **Health check**: `GET https://<domain>/api/health` → `200 {"status":"ok","database":"up"}`; `503` nếu mất kết nối database. Không ghi log, không cần đăng nhập.
- Dùng một dịch vụ giám sát uptime bên ngoài gọi URL trên mỗi 1–5 phút và báo qua email/điện thoại khi lỗi — nó phát hiện cả sự cố máy chủ, nginx, chứng chỉ hết hạn lẫn DNS.
- Docker cũng dùng health check này: `qrc ps` hiện `(healthy)`/`(unhealthy)`. Container tự khởi động lại khi tiến trình dừng (`restart: unless-stopped`) và khi máy chủ khởi động lại.
- Theo dõi dung lượng ổ đĩa (`df -h`): database, ảnh đại diện và bản sao lưu cùng tăng theo số khách.

## Log

App ghi log dạng JSON, mỗi dòng một sự kiện. Docker giữ tối đa 5 × 10 MB mỗi container (đã cấu hình trong `compose.yml`).

```bash
qrc logs app --since 1h                   # 1 giờ gần nhất
qrc logs app -f                           # theo dõi trực tiếp
qrc logs app --since 24h | grep '"level":50'          # lỗi (500, lỗi gửi email...)
qrc logs app --since 24h | grep '"level":40'          # cảnh báo (4xx, đăng nhập sai...)
qrc logs app | grep '<request-id>'                    # tra một request cụ thể
```

**Log không chứa**: mật khẩu, OTP, cookie, header, query string, token QR (bị thay bằng `[redacted]`), địa chỉ IP, nội dung hồ sơ khách, tham số truy vấn database. Chỉ có method, đường dẫn, mã trạng thái, thời gian xử lý và id nội bộ.

**Mã request**: mỗi phản hồi có header `X-Request-Id`, trùng với `req.id` trong log. Khi người dùng báo lỗi, mã này giúp tìm đúng dòng log.

Sự kiện cần chú ý:

| Thông điệp                                 | Mức   | Ý nghĩa / việc cần làm                                                                                                                                                |
| ------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.refresh.reuse_detected`              | warn  | Một refresh token đã dùng rồi bị dùng lại — có thể cookie bị đánh cắp. App đã tự thu hồi cả phiên. Nếu lặp lại với cùng `userId`: liên hệ người dùng, reset mật khẩu. |
| `auth.login.failed` (nhiều, cùng `userId`) | warn  | Có người dò mật khẩu; tài khoản tự khóa 15 phút sau 5 lần sai                                                                                                         |
| `auth.password_reset.delivery_failed`      | error | Không gửi được email OTP — kiểm tra tài khoản SMTP (mật khẩu, hạn mức)                                                                                                |
| `auth.password_reset.hourly_limit`         | warn  | Một tài khoản yêu cầu OTP quá 5 lần/giờ                                                                                                                               |
| `maintenance.failed`                       | error | Dọn phiên hết hạn thất bại — thường do mất kết nối DB                                                                                                                 |
| `Database migration failed; not starting`  | fatal | Migration lỗi khi cập nhật → app không chạy. Xem mục [Sự cố](#xử-lý-sự-cố)                                                                                            |
| `PostgreSQL idle client error`             | error | Kết nối DB bị ngắt (DB khởi động lại) — pool tự kết nối lại                                                                                                           |
| `request completed` với `statusCode` 500   | error | Lỗi không mong đợi; dòng log kèm `err` (đã lọc dữ liệu nhạy cảm)                                                                                                      |

## Audit log

Mọi thao tác quản trị (tạo/sửa/khóa khách, reset mật khẩu, đổi ảnh, tạo/thu hồi QR) và thay đổi của khách được ghi vào bảng `audit_logs` — chỉ tên trường và trạng thái, không có nội dung hồ sơ.

```bash
qrc exec db psql -U qrcare -d qrcare -c "
  select a.created_at, a.action, actor.email as actor, a.target_user_id, a.metadata
  from audit_logs a left join users actor on actor.id = a.actor_user_id
  order by a.created_at desc limit 50;"
```

Các `action`: `CUSTOMER_CREATED`, `CUSTOMER_UPDATED`, `CUSTOMER_STATUS_CHANGED`, `CUSTOMER_PASSWORD_RESET`, `CUSTOMER_AVATAR_UPDATED`, `CUSTOMER_AVATAR_REMOVED`, `QR_GENERATED`, `QR_REGENERATED`, `QR_REVOKED`, `PROFILE_UPDATED_BY_OWNER`, `PASSWORD_RESET_BY_OTP`.

## Sao lưu

`deploy/backup.sh` tạo 2 file mỗi lần chạy trong `BACKUP_DIR` (mặc định `/var/backups/qrcare`, chỉ chủ sở hữu đọc được):

- `db-<thời gian>.dump` — toàn bộ database (định dạng nén của `pg_dump`).
- `storage-<thời gian>.tar.gz` — toàn bộ ảnh đại diện.

Script chỉ tạo file khi bước đó thành công (lỗi → không để lại file rỗng, trả mã lỗi ≠ 0) và xóa bản cũ hơn `KEEP_DAYS` ngày (mặc định 14).

Lên lịch lúc 2:15 sáng mỗi ngày:

```bash
sudo crontab -e
# thêm dòng:
15 2 * * * /opt/qrcare/deploy/backup.sh >> /var/log/qrcare-backup.log 2>&1
```

**Bản sao ngoài máy chủ** (bắt buộc — mất máy chủ thì bản sao lưu trên chính nó cũng mất): sau khi `backup.sh` chạy, chép `BACKUP_DIR` sang nơi khác bằng công cụ có **mã hóa phía client** (ví dụ `restic` hoặc `rclone` với lớp `crypt`). Bản sao lưu chứa dữ liệu cá nhân và sức khỏe (nhóm máu, cân nặng...) nên phải được mã hóa, giới hạn người truy cập và xóa theo thời hạn đã định.

## Khôi phục

Dùng khi mất dữ liệu hoặc cập nhật lỗi. **Ghi đè toàn bộ dữ liệu hiện tại** bằng bản sao lưu — dữ liệu phát sinh sau thời điểm sao lưu sẽ mất.

```bash
B=/var/backups/qrcare
DB=$B/db-20260101-021500.dump               # chọn bản cần khôi phục
FILES=$B/storage-20260101-021500.tar.gz

qrc stop app                                 # ngừng nhận request

# Database
qrc exec -T db dropdb -U qrcare qrcare
qrc exec -T db createdb -U qrcare qrcare
qrc exec -T db pg_restore -U qrcare -d qrcare --no-owner < "$DB"

# Ảnh đại diện
qrc run --rm --no-deps -T app sh -c 'find /data/storage -mindepth 1 -delete && tar -C /data -xzf -' < "$FILES"

qrc start app
qrc logs app --tail 5                        # "listening"; rồi mở trang web kiểm tra
```

Khôi phục lên **máy chủ mới**: cài theo [deployment.md](deployment.md) bước 1–3 với **cùng** `production.env` (đặc biệt `PUBLIC_QR_BASE_URL`; nếu mất file này thì tạo secret mới — mọi người chỉ cần đăng nhập lại), sau đó chạy các lệnh trên.

### Thử khôi phục định kỳ

Bản sao lưu chưa từng khôi phục thử thì chưa chắc dùng được. Mỗi quý, khôi phục vào một database tạm (không ảnh hưởng hệ thống đang chạy):

```bash
DB=$(ls -t /var/backups/qrcare/db-*.dump | head -1)
qrc exec -T db createdb -U qrcare restore_check
qrc exec -T db pg_restore -U qrcare -d restore_check --no-owner < "$DB"
qrc exec -T db psql -U qrcare -d restore_check -c "select role, count(*) from users group by role;"
qrc exec -T db dropdb -U qrcare restore_check
tar -tzf "$(ls -t /var/backups/qrcare/storage-*.tar.gz | head -1)" | wc -l     # số file ảnh
```

Số tài khoản và số ảnh phải khớp với hệ thống thật.

## Quản trị thường gặp

| Tình huống                      | Cách xử lý                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Admin quên mật khẩu             | `qrc exec app node dist/scripts/seed-admin.js <email-admin> --reset` → mật khẩu tạm mới, bắt buộc đổi  |
| Thêm người quản trị             | `qrc exec app node dist/scripts/seed-admin.js <email-moi>` — mỗi người một tài khoản, không dùng chung |
| Khách quên mật khẩu             | Khách dùng "Quên mật khẩu" (email), hoặc admin bấm "Đặt lại mật khẩu" trong trang chi tiết khách       |
| Khách bị khóa do nhập sai 5 lần | Tự mở sau 15 phút; hoặc khách đặt lại mật khẩu qua OTP                                                 |
| Áo bị mất / QR bị lạm dụng      | Trang QR của khách → "Tạo lại mã QR" (mã cũ ngừng hoạt động ngay) → in QR mới                          |
| Khách ngừng sử dụng dịch vụ     | Vô hiệu hóa tài khoản: không đăng nhập được, trang QR công khai trả "không tìm thấy"                   |

## Cập nhật bảo mật

- **Image nền** (Node, Debian, PostgreSQL) — hằng tháng: `qrc build --pull && qrc up -d`. PostgreSQL chỉ cập nhật bản vá trong cùng phiên bản 17; nâng phiên bản chính (18...) cần dump/restore, làm theo kế hoạch riêng.
- **Dependency của app**: CI chạy `npm audit` ở mỗi lần push. Định kỳ cập nhật dependency trên máy dev, chạy toàn bộ test (`npm test`, `npm run test:e2e`), đẩy lên, rồi cập nhật máy chủ theo [deployment.md](deployment.md#cập-nhật-phiên-bản-mới).
- **Hệ điều hành máy chủ**: bật `unattended-upgrades` (Ubuntu/Debian).

## Xử lý sự cố

| Triệu chứng                                           | Nguyên nhân thường gặp                                 | Cách xử lý                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Container app khởi động rồi dừng ngay                 | Cấu hình sai                                           | `qrc logs app`: dòng `Invalid environment configuration: <TÊN_BIẾN>` → sửa biến đó trong `production.env`, `qrc up -d` |
| `Database migration failed; not starting`             | Cập nhật lỗi / DB không kết nối được                   | Xem lỗi chi tiết trong log; quay về bản cũ + khôi phục bản sao lưu trước cập nhật                                      |
| Trình duyệt báo 502 Bad Gateway                       | App không chạy                                         | `qrc ps`, `qrc logs app`                                                                                               |
| Đăng nhập báo lỗi / mọi thao tác lưu bị từ chối (403) | `APP_ORIGIN` khác địa chỉ đang mở (http/https, www...) | Sửa `APP_ORIGIN` đúng địa chỉ người dùng truy cập                                                                      |
| Nhiều người cùng bị "thử lại sau" (429)               | `TRUST_PROXY` sai → mọi request coi như cùng một IP    | Sau nginx: `TRUST_PROXY=1`                                                                                             |
| QR quét ra sai domain                                 | `PUBLIC_QR_BASE_URL` sai                               | Sửa trước khi in áo. Áo **đã in** không sửa được — chỉ có thể giữ domain cũ hoạt động                                  |
| Không nhận được email OTP                             | SMTP sai / bị chặn / vào thư rác                       | Tìm `auth.password_reset.delivery_failed` trong log; kiểm tra SPF/DKIM của domain gửi                                  |
| Trang trắng sau khi cập nhật                          | Trình duyệt giữ bản cũ                                 | App hiện thông báo kèm nút "Tải lại trang"; nếu không, nhấn Ctrl+F5                                                    |
| Health trả 503                                        | Database dừng hoặc đầy ổ đĩa                           | `qrc ps`, `qrc logs db`, `df -h`                                                                                       |

## Sự cố bảo mật

Khi nghi ngờ bị xâm nhập hoặc lộ dữ liệu:

1. **Ghi lại** thời điểm, dấu hiệu; lưu log (`qrc logs app > incident-<ngày>.log`) và audit log trước khi thay đổi gì.
2. **Khoanh vùng** theo loại sự cố:
   - Lộ `JWT_ACCESS_SECRET`: đổi giá trị trong `production.env`, `qrc up -d` → mọi phiên bị vô hiệu, tất cả đăng nhập lại.
   - Lộ `OTP_SECRET`: đổi giá trị → các mã OTP đang chờ mất hiệu lực.
   - Lộ mật khẩu database: đổi bằng `ALTER USER qrcare PASSWORD '...'` trong `psql`, cập nhật `POSTGRES_PASSWORD`, `qrc up -d`.
   - Tài khoản admin bị chiếm: reset bằng lệnh `seed-admin --reset`, xem audit log để biết đã bị thay đổi gì.
   - Token QR của khách bị lạm dụng: tạo mã mới cho khách đó.
3. **Khắc phục** lỗ hổng gốc, cập nhật, khôi phục dữ liệu bị sửa từ bản sao lưu nếu cần.
4. **Thông báo**: nếu dữ liệu cá nhân bị lộ, thực hiện nghĩa vụ thông báo cho cơ quan chức năng và người bị ảnh hưởng theo quy định bảo vệ dữ liệu cá nhân hiện hành của Việt Nam (có thời hạn bắt buộc) — nên hỏi tư vấn pháp lý.
