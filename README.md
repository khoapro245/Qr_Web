# QR Care

Hệ thống thông tin cá nhân qua mã QR gắn trên áo. Mỗi áo có một mã QR riêng; ai quét mã đều xem được thông tin hỗ trợ (được phép công khai) của người mặc mà không cần đăng nhập.

> Trạng thái: đang phát triển — đã xong Milestone 1–4 (khởi tạo, database, đăng nhập, quản lý khách hàng).
> Kiến trúc và các quyết định: [docs/architecture.md](docs/architecture.md) · API: [docs/api.md](docs/api.md).

## Công nghệ

| Phần     | Công nghệ                                              |
| -------- | ------------------------------------------------------ |
| Backend  | Node.js 22.12+ (khuyến nghị 24), TypeScript, Express 5 |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4             |
| Database | PostgreSQL (Drizzle ORM)                               |
| Test     | Vitest, Supertest, Testing Library                     |

## Cấu trúc thư mục

```text
├── backend/    API Express (src/, tests/)
├── frontend/   React SPA (src/, tests/)
├── shared/     Enum + schema validate dùng chung cho backend và frontend
└── docs/       Tài liệu kiến trúc, API, triển khai
```

## Chạy ở máy local

### Yêu cầu

- Node.js ≥ 22.12 (khuyến nghị 24 LTS) và npm ≥ 10
- PostgreSQL 15+ — dùng **Docker Desktop** (khuyến nghị) hoặc cài trực tiếp trên Windows

### Các bước

```bash
# 1. Cài dependencies cho mọi workspace
npm install

# 2. Tạo file cấu hình backend (giá trị mặc định khớp với docker-compose.yml),
#    rồi thay JWT_ACCESS_SECRET bằng chuỗi ngẫu nhiên sinh từ lệnh:
#    node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
cp backend/.env.example backend/.env

# 3. Khởi động PostgreSQL (tạo sẵn 2 database: qrcare và qrcare_test)
docker compose up -d

# 4. Tạo bảng
npm run db:migrate -w backend

# 5. Tạo tài khoản admin đầu tiên — mật khẩu tạm được in ra MỘT lần
npm run db:seed-admin -w backend -- admin@example.com

# 6. Chạy cả backend (http://127.0.0.1:4000) và frontend (http://localhost:5173)
npm run dev
```

Mở http://localhost:5173 và đăng nhập bằng email admin cùng mật khẩu tạm ở bước 5. Lần đăng nhập đầu, hệ thống bắt buộc đổi mật khẩu.

### Không dùng Docker? Cài PostgreSQL trực tiếp

1. Cài PostgreSQL 17 cho Windows từ https://www.postgresql.org/download/windows/.
2. Mở `psql` bằng user `postgres` và chạy:
   ```sql
   CREATE USER qrcare WITH PASSWORD 'mat-khau-cua-ban';
   CREATE DATABASE qrcare OWNER qrcare;
   CREATE DATABASE qrcare_test OWNER qrcare;
   ```
3. Sửa `DATABASE_URL` và `TEST_DATABASE_URL` trong `backend/.env` cho khớp mật khẩu, rồi làm tiếp từ bước 4.

## Database

| Lệnh (chạy với `-w backend`)               | Tác dụng                                                       |
| ------------------------------------------ | -------------------------------------------------------------- |
| `npm run db:migrate`                       | Áp dụng các migration chưa chạy                                |
| `npm run db:generate -- --name <ten>`      | Sinh migration SQL mới sau khi sửa `backend/src/db/schema.ts`  |
| `npm run db:seed-admin -- <email>`         | Tạo admin (mật khẩu tạm in ra một lần, phải đổi khi đăng nhập) |
| `npm run db:seed-admin -- <email> --reset` | Reset mật khẩu admin (khi admin quên mật khẩu)                 |
| `npm run db:studio`                        | Mở Drizzle Studio để xem dữ liệu                               |

- Muốn tự đặt mật khẩu admin thay vì sinh ngẫu nhiên: đặt biến `ADMIN_PASSWORD` (≥ 12 ký tự) trước khi chạy lệnh seed.
- Test tự động dùng database `qrcare_test` (`TEST_DATABASE_URL`) và **xóa toàn bộ dữ liệu** trong đó; bộ test từ chối chạy nếu tên database không kết thúc bằng `_test`.
- Production: chạy `node dist/scripts/migrate.js` trong thư mục `backend` sau mỗi lần deploy.

## Scripts

| Lệnh                | Tác dụng                                          |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Chạy shared (watch), backend và frontend cùng lúc |
| `npm run build`     | Build production cho cả 3 workspace               |
| `npm run typecheck` | Kiểm tra kiểu TypeScript                          |
| `npm run lint`      | ESLint (có type-aware rules)                      |
| `npm run format`    | Định dạng code bằng Prettier                      |
| `npm test`          | Chạy toàn bộ test backend + frontend              |

## Bảo mật

- Không bao giờ commit file `.env`. Chỉ `.env.example` (giá trị giả) được đưa lên Git.
- Xem thêm các biện pháp bảo mật trong [docs/architecture.md](docs/architecture.md).
