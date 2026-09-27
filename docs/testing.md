# Kiểm thử QR Care

Ba lớp kiểm thử, mỗi lớp bắt một loại lỗi khác nhau. Tất cả chạy tự động trên GitHub Actions ở mỗi lần push (`.github/workflows/ci.yml`).

| Lớp                         | Công cụ                                   | Chạy trên                                                                        | Lệnh                       | Thời gian          |
| --------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- | -------------------------- | ------------------ |
| Backend: unit + tích hợp    | Vitest + Supertest                        | API thật + PostgreSQL thật (`qrcare_test`)                                       | `npm run test -w backend`  | ~20 giây           |
| Frontend: component + luồng | Vitest + Testing Library + MSW + axe-core | jsdom, API giả lập                                                               | `npm run test -w frontend` | ~7 giây            |
| End-to-end                  | Playwright                                | Trình duyệt thật + **bản build production** + API thật + DB riêng (`qrcare_e2e`) | `npm run test:e2e`         | ~30 giây (+ build) |

```bash
npm test                # backend + frontend
npm run test:coverage   # như trên, kèm báo cáo độ bao phủ (backend/coverage, frontend/coverage)
npm run test:e2e        # end-to-end (tự khởi động API và web riêng — không cần npm run dev)
npm run test:e2e:report # mở báo cáo HTML của lần chạy E2E gần nhất
```

## Backend (`backend/tests`)

- Chạy trên database `qrcare_test` (`TEST_DATABASE_URL`). Bộ test **từ chối chạy** nếu tên database không kết thúc bằng `_test`, vì mỗi test xóa sạch dữ liệu.
- Bao phủ: xác thực và phiên, phân quyền, quản lý khách hàng, ảnh (giải mã/EXIF), vòng đời QR (kể cả đồng thời), trang công khai, OTP (kể cả đoán song song), cấu hình production, tấn công (`security.test.ts` tự dò **mọi route** để kiểm tra phân quyền và CSRF), SMTP thật với server giả.
- Độ bao phủ: ~96% dòng, ~84% nhánh.

## Frontend (`frontend/tests`)

- Render toàn bộ ứng dụng (router, guard, provider thật) với API giả lập bằng MSW.
- `a11y.test.tsx` chạy axe-core (WCAG 2.x A/AA) trên 9 màn hình chính.
- Độ bao phủ: ~94% dòng, ~85% nhánh.

## End-to-end (`e2e/`)

Playwright tự khởi động:

1. **API** ở cổng 4100 (`e2e/scripts/start-backend.ts`): tạo database `qrcare_e2e` nếu chưa có, chạy migration, xóa sạch dữ liệu, tạo một admin thử nghiệm, rồi chạy server. Thư mục ảnh và "hộp thư" OTP nằm trong thư mục tạm của hệ thống.
2. **Web** ở cổng 4174: **bản build production** (kèm Content-Security-Policy) chạy bằng `vite preview`.

Kịch bản (17 test, trong đó trang QR công khai chạy cả trên màn hình điện thoại Pixel 7):

| File                        | Kiểm tra                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `admin.setup.ts`            | Admin đăng nhập lần đầu → bắt buộc đổi mật khẩu                                                                             |
| `admin-customer.spec.ts`    | Tạo khách qua giao diện + ảnh → mật khẩu tạm hiện 1 lần → tải PNG QR và **giải mã** lại đúng đường dẫn                      |
| `public-qr.spec.ts`         | Người lạ (không đăng nhập) chỉ thấy thông tin cho phép, ảnh tải được, không có email/SĐT đăng nhập; header riêng tư; mã sai |
| `qr-lifecycle.spec.ts`      | Tạo lại QR → link cũ ngừng ngay; vô hiệu hóa → QR ẩn, không đăng nhập được; kích hoạt lại                                   |
| `customer.spec.ts`          | Khách đăng nhập bằng SĐT → đổi mật khẩu → sửa hồ sơ → trang công khai cập nhật; bị chặn khỏi admin                          |
| `password-recovery.spec.ts` | Khôi phục qua OTP email (đọc mã thật từ hộp thư thử nghiệm); không lộ tài khoản tồn tại                                     |
| `security.spec.ts`          | XSS lưu trong hồ sơ hiển thị thành chữ, 0 hộp thoại, 0 vi phạm CSP; khách gọi thẳng API admin → 403                         |

### Cấu hình

- Máy dev: dùng Microsoft Edge có sẵn (`PW_CHANNEL` mặc định `msedge`) và thông tin database từ `backend/.env` (`TEST_DATABASE_URL` → đổi `_test` thành `_e2e`).
- CI / máy khác: đặt `E2E_DATABASE_URL` (phải kết thúc bằng `_e2e`), `PW_CHANNEL=""` và chạy `npx playwright install --with-deps chromium` một lần.
- Tài khoản PostgreSQL cần quyền `CREATE DATABASE` cho lần chạy đầu (Docker dev đã có); nếu không, tạo `qrcare_e2e` thủ công.
- `DEV_OUTBOX_FILE` (ghi OTP ra file cho E2E) bị **từ chối** khi `NODE_ENV=production`.

## CI (GitHub Actions)

Mỗi push lên `main` và mỗi pull request chạy hai job song song:

1. **quality**: format → lint → typecheck → test + coverage → build → `npm audit` (dependency production, mức moderate trở lên).
2. **e2e**: Playwright với Chromium; khi thất bại, báo cáo và ảnh chụp được lưu thành artifact 7 ngày.

Trước khi đưa vào dự án, workflow đã được **giả lập trên một bản clone sạch** (không `.env`, `npm ci` từ lockfile). Lần giả lập đó phát hiện `npm run lint` hỏng trên clone mới (thiếu `shared/dist`) — đã sửa bằng cách build `shared` trước khi lint.
