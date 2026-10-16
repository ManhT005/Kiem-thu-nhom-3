# PHASE 1 IMPLEMENTATION PLAN
# STABILIZATION & API CONTRACT FOUNDATION

**Project:** `ManhT005/Kiem-thu-nhom-3`  
**Baseline:** `main/develop @ 5d169de8bab9c47d12d7e77f610905bb24a30591`  
**Branch đề xuất:** `feat/phase-1-api-foundation`  
**Mục tiêu:** Ổn định project trước khi triển khai Order State Machine, Transaction, Inventory, Voucher và Dashboard.

---

# 1. Mục tiêu Phase 1

Phase 1 không thêm module business lớn.

Phase này phải tạo ra một baseline có các đặc tính:

```text
Reproducible
Secure-by-default
Predictable API contract
Validatable
Testable
Regression-ready
```

Khi Phase 1 hoàn tất:

- developer clone repo có thể dựng DB
- `.env` không nằm trong Git
- protected route thực sự protected
- role permission có middleware chuẩn
- API success/error có format nhất quán
- validation chạy ở backend
- raw SQL error không leak
- frontend không phụ thuộc hard-coded localhost
- Postman/Newman có smoke suite đầu tiên

---

# 2. Out of Scope

Không làm trong Phase 1:

- full Order State Machine
- Order audit history
- Goods Receipt
- Inventory Movement
- Voucher
- Dashboard
- full MoMo IPN lifecycle
- migrate sang TypeScript
- migrate frontend framework
- rewrite project architecture

Các nội dung trên thuộc phase sau.

---

# 3. Workstream A - Repository Hygiene

## A1. Untrack `node_modules`

Current repo đang track:

```text
backend/node_modules/
```

Thực hiện:

```bash
git rm -r --cached backend/node_modules
```

Xác nhận `.gitignore` có:

```gitignore
node_modules/
```

### Acceptance Criteria

```text
git ls-files | grep node_modules
```

không trả kết quả.

---

## A2. Environment files

Thêm:

```text
.env
backend/.env
```

vào `.gitignore`.

Tạo:

```text
backend/.env.example
```

Ví dụ:

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=clothes_db

JWT_SECRET=change-me
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:3000
```

Xóa `backend/.env` khỏi tracking.

Không xóa file local của từng developer.

---

## A3. Load dotenv đúng entry point

Trong `backend/server.js`:

```js
import "dotenv/config";
```

phải xuất hiện trước code đọc `process.env`.

### Test

- đổi `PORT`
- đổi `DB_NAME`
- chạy server
- xác nhận config được load

---

## A4. JWT secret

Xóa:

```text
SECRET_KEY_123
```

khỏi source.

Target:

```js
process.env.JWT_SECRET
```

Server phải fail fast nếu thiếu secret.

Ví dụ:

```text
CONFIG_ERROR
JWT_SECRET is required
```

---

## A5. CORS config

Development:

```text
CORS_ORIGIN=http://localhost:3000
```

Nếu frontend và backend cùng origin thì ưu tiên relative API URL.

Không giữ `cors()` mở toàn bộ như production baseline.

---

# 4. Workstream B - Database Baseline

## B1. Khôi phục schema cũ từ Git history

Schema có thể phục hồi từ commit:

```text
164dc65e85d9f00ad70cdc1b5e979aa4e3a9ee9a
```

file:

```text
dbshop.sql
```

Không copy nguyên file thành một dump lâu dài rồi tiếp tục chỉnh tay.

Tách thành:

```text
database/
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 002_seed_reference_data.sql
├── seeds/
│   ├── test_users.sql
│   ├── test_products.sql
│   └── test_orders.sql
└── README.md
```

---

## B2. Sửa `.gitignore`

Không ignore toàn bộ:

```gitignore
*.sql
```

Thay bằng pattern local dump:

```gitignore
*.local.sql
*.dump.sql
database/local/
```

Migration/seed phải được track.

---

## B3. Chuẩn hóa reference data

Seed tối thiểu:

### Size

```text
S
M
L
XL
XXL
```

### Payment Method

```text
COD
BANK_TRANSFER
MOMO
```

### Test Users

```text
admin
staff
user
```

Password seed phải được hash hoặc có seed script.

---

## B4. DB reset workflow

Tạo script hoặc hướng dẫn:

```bash
npm run db:reset
npm run db:seed
```

Có thể dùng Node script nếu muốn tránh shell phụ thuộc OS.

### Definition

`db:reset`:

1. create database / clean database
2. execute migrations
3. execute deterministic seeds

### Acceptance Criteria

Một thành viên mới:

```text
clone
npm install
copy .env.example -> .env
npm run db:reset
npm run dev
```

và hệ thống hoạt động.

---

# 5. Workstream C - API Response Contract

## C1. Tạo response utility

File đề xuất:

```text
backend/utils/api-response.js
```

API:

```js
success(res, {
  status = 200,
  code = "SUCCESS",
  message = "Success",
  data = null
})

error(res, {
  status,
  code,
  message,
  errors
})
```

### Success Contract

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Operation completed",
  "data": {}
}
```

### Error Contract

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "errors": [
    {
      "field": "email",
      "message": "Email is invalid"
    }
  ]
}
```

---

## C2. Error Code Catalog

Tạo constants:

```text
SUCCESS
CREATED
VALIDATION_ERROR
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
CONFLICT
INSUFFICIENT_STOCK
INVALID_CREDENTIALS
INTERNAL_ERROR
```

Không phụ thuộc toàn bộ assertion vào message tiếng Việt.

Test nên assertion bằng:

```text
HTTP status + code
```

---

# 6. Workstream D - Central Error Handling

## D1. AppError

File:

```text
backend/utils/app-error.js
```

Structure:

```text
status
code
message
details
```

---

## D2. 404 middleware

File:

```text
backend/middleware/not-found.middleware.js
```

Unknown route trả:

```http
404
```

```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "API endpoint not found"
}
```

---

## D3. Global error middleware

File:

```text
backend/middleware/error.middleware.js
```

Yêu cầu:

- không trả stack ở production
- không trả raw DB object
- map duplicate key thành `409`
- default `500 INTERNAL_ERROR`

---

# 7. Workstream E - Authentication & Authorization

## E1. Tách strict auth và optional auth

Current `verifyToken` đang hoạt động như optional auth.

Target:

```js
authenticate
optionalAuthenticate
authorizeRoles
```

### authenticate

Không token:

```http
401 UNAUTHENTICATED
```

Token invalid:

```http
401 UNAUTHENTICATED
```

Token expired:

```http
401 UNAUTHENTICATED
```

Token valid:

```js
req.user = decoded
next()
```

---

## E2. Role middleware

File:

```text
backend/middleware/authorize.middleware.js
```

Interface:

```js
authorizeRoles("admin")
authorizeRoles("admin", "staff")
```

Không đủ quyền:

```http
403 FORBIDDEN
```

---

## E3. Route permission baseline

### Auth

```text
POST /api/auth/register      public
POST /api/auth/login         public
```

### Product

```text
GET    /api/products         public
GET    /api/products/:id     public
POST   /api/products         admin
PUT    /api/products/:id     admin
DELETE /api/products/:id     admin
```

Giữ như current scope trong Phase 1.

### User

```text
/profile                     authenticated
/address                     authenticated
/admin user management       admin
```

### Cart

Tất cả:

```text
authenticated
```

### Order

```text
POST /api/orders/create      authenticated user
GET  /api/orders/my-orders   authenticated
GET  /api/orders/all         admin/staff
PUT  /api/orders/:id/status  admin/staff
```

Business transition chưa làm Phase 1, nhưng quyền phải được khóa ngay.

### Inventory

```text
GET /api/kho                 admin/staff
PUT /api/kho/:maSP           admin/staff
```

`PUT` là legacy API và sẽ bị thay ở Phase 3, nhưng hiện tại vẫn phải protected.

---

## E4. Test matrix bắt buộc

| Case | Expected |
|---|---|
| No token -> `/api/cart` | 401 |
| Invalid token -> `/api/cart` | 401 |
| User -> `/api/users` | 403 |
| Staff -> delete product | 403 nếu policy hiện hành chỉ Admin |
| User -> `/api/orders/all` | 403 |
| No token -> `/api/orders/all` | 401 |
| No token -> PUT `/api/kho/:id` | 401 |
| User -> PUT `/api/kho/:id` | 403 |
| Staff -> PUT `/api/kho/:id` | 200 nếu payload hợp lệ |

---

# 8. Workstream F - Validation Layer

## F1. Library

Đề xuất dùng:

```text
express-validator
```

Lý do:

- phù hợp Express hiện tại
- JavaScript thuần
- learning curve thấp
- dễ map errors về Postman assertions
- không ép refactor lớn

---

## F2. Structure

```text
backend/validators/
├── auth.validator.js
├── user.validator.js
├── cart.validator.js
├── product.validator.js
├── order.validator.js
└── inventory.validator.js
```

Middleware:

```text
backend/middleware/validate.middleware.js
```

---

## F3. Auth rules

### Register

`ten`

```text
required
trim
2..100 chars
```

`email`

```text
required
valid email
normalize
max length
```

`matKhau`

Theo Master Test Plan:

```text
8..32 chars
```

### Login

```text
email required
password required
```

Sai credentials:

```http
401 INVALID_CREDENTIALS
```

Không nên phân biệt quá rõ:

```text
email không tồn tại
sai password
```

nếu muốn tránh account enumeration.

---

## F4. User rules

Phone:

```text
10 digits
prefix 03/05/07/08/09
```

Address:

```text
required
trim
reasonable max length
```

Role:

```text
user | staff | admin
```

ID params:

```text
positive integer
```

---

## F5. Cart rules

```text
maSP positive integer
maSize positive integer
soLuong integer >= 1
```

Phase 1 validate type/range.

Full stock business validation có thể hoàn thiện ở Phase 2 khi checkout/order transaction được refactor.

---

## F6. Inventory legacy update rules

```text
inventory is array
maSize positive integer
soLuong integer >= 0
```

Reject:

- negative stock
- NaN
- string không parse được
- duplicate malformed element

---

## F7. Product rules

```text
tenSP required
gia integer > 0
sizes valid JSON array
soLuongTon >= 0
image type/size checked
```

---

# 9. Workstream G - Frontend API Configuration

## G1. Remove hard-coded localhost

Thay:

```js
fetch("http://localhost:3000/api/...")
```

bằng:

```js
fetch("/api/...")
```

Do frontend đang được serve cùng Express origin.

Ưu điểm:

- local chạy
- deploy chạy
- test reverse proxy chạy
- không cần sửa từng file

---

## G2. Optional API helper

Tạo:

```text
frontend/js/api.js
```

Hỗ trợ:

```js
apiFetch(path, options)
```

Tự động:

- set Authorization
- parse JSON
- xử lý 401
- normalize error

Không bắt buộc refactor 100% trong Phase 1 nếu scope quá lớn.

Ưu tiên các file:

- login.js
- Header.js
- cart.js
- checkout.js
- profile.js
- admin/staff scripts

---

# 10. Workstream H - Initial Test Automation

## H1. Folder

```text
tests/
└── postman/
    ├── ClothesShop.postman_collection.json
    ├── local.postman_environment.json
    └── data/
```

Secrets không commit vào environment.

---

## H2. Smoke collection scope

Phase 1 chưa cần 100% test coverage.

Tạo smoke tests cho:

### Health/API availability

Có thể thêm:

```text
GET /api/health
```

Response:

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "status": "UP"
  }
}
```

### Auth

- register valid
- register invalid email
- password length 7
- password length 8
- login valid
- login wrong password

### Auth protection

- no token
- invalid token
- insufficient role

### Product

- GET list
- GET missing ID
- create without auth
- create as user
- create as admin

### Cart

- no token -> 401
- invalid quantity -> 400

### Inventory

- no token -> 401
- user -> 403

---

## H3. Newman scripts

Root `package.json`:

```json
{
  "scripts": {
    "test:api": "newman run tests/postman/ClothesShop.postman_collection.json -e tests/postman/local.postman_environment.json --reporters cli",
    "test:api:report": "newman run tests/postman/ClothesShop.postman_collection.json -e tests/postman/local.postman_environment.json --reporters cli,htmlextra"
  }
}
```

Add dev dependencies:

```text
newman
newman-reporter-htmlextra
```

---

# 11. Recommended File Changes

## New

```text
backend/.env.example
backend/utils/api-response.js
backend/utils/app-error.js

backend/middleware/authenticate.middleware.js
backend/middleware/authorize.middleware.js
backend/middleware/validate.middleware.js
backend/middleware/not-found.middleware.js
backend/middleware/error.middleware.js

backend/validators/auth.validator.js
backend/validators/user.validator.js
backend/validators/cart.validator.js
backend/validators/product.validator.js
backend/validators/order.validator.js
backend/validators/inventory.validator.js

database/migrations/001_initial_schema.sql
database/seeds/001_reference_data.sql
database/seeds/002_test_users.sql
database/README.md

tests/postman/ClothesShop.postman_collection.json
tests/postman/local.postman_environment.json
```

## Update

```text
.gitignore
package.json
backend/package.json
backend/server.js
backend/config/config.js
backend/config/db.js
backend/controllers/*
backend/routes/*
frontend/js/*
```

## Remove from Git tracking

```text
backend/.env
backend/node_modules/
```

---

# 12. Implementation Order

Không triển khai ngẫu nhiên.

Thứ tự:

```text
Step 1 Repository cleanup
        ↓
Step 2 Environment/config
        ↓
Step 3 Database baseline
        ↓
Step 4 Response/error foundation
        ↓
Step 5 Strict authentication
        ↓
Step 6 Authorization
        ↓
Step 7 Validation
        ↓
Step 8 Route/controller migration
        ↓
Step 9 Frontend API URL cleanup
        ↓
Step 10 Postman/Newman smoke
        ↓
Step 11 Regression + docs
```

---

# 13. Suggested Task Breakdown

| ID | Task | Priority | Dependency |
|---|---|---:|---|
| P1-01 | Untrack node_modules | P0 | None |
| P1-02 | `.env.example` + gitignore | P0 | None |
| P1-03 | env config + fail-fast JWT secret | P0 | P1-02 |
| P1-04 | Restore DB baseline/migration | P0 | None |
| P1-05 | Seed admin/staff/user | P0 | P1-04 |
| P1-06 | API response utility | P0 | None |
| P1-07 | AppError + global error middleware | P0 | P1-06 |
| P1-08 | Strict authenticate middleware | P0 | P1-03, P1-07 |
| P1-09 | authorizeRoles middleware | P0 | P1-08 |
| P1-10 | Protect Order routes | P0 | P1-09 |
| P1-11 | Protect Inventory routes | P0 | P1-09 |
| P1-12 | Validation middleware | P0 | P1-07 |
| P1-13 | Auth validators | P0 | P1-12 |
| P1-14 | User validators | P1 | P1-12 |
| P1-15 | Cart validators | P1 | P1-12 |
| P1-16 | Product/Order/Inventory basic validators | P1 | P1-12 |
| P1-17 | Normalize controller responses | P1 | P1-06 |
| P1-18 | Replace localhost API URLs | P1 | None |
| P1-19 | Add `/api/health` | P1 | P1-06 |
| P1-20 | Postman smoke collection | P0 | P1-10..19 |
| P1-21 | Newman scripts/report | P0 | P1-20 |
| P1-22 | Update README/runbook | P1 | All |

---

# 14. PR Strategy

Không nên gom Phase 1 thành một commit khổng lồ.

Có thể dùng một branch nhưng chia commit logic.

Đề xuất:

```text
feat/phase-1-api-foundation
```

Commits:

```text
chore: clean repository dependencies and environment files

chore: restore database baseline and deterministic seeds

refactor: add standard API response and centralized error handling

fix: enforce strict authentication for protected APIs

feat: add reusable role authorization middleware

feat: add request validation middleware and schemas

fix: secure order and inventory management endpoints

refactor: use relative API URLs in frontend

test: add Postman smoke collection and Newman scripts

docs: add local setup and testing guide
```

---

# 15. Definition of Done Phase 1

Phase 1 chỉ được merge khi đạt tất cả:

## Repository

- [ ] `backend/node_modules` không còn tracked
- [ ] `.env` không tracked
- [ ] `.env.example` tồn tại

## Configuration

- [ ] JWT secret từ env
- [ ] dotenv load đúng
- [ ] CORS config được kiểm soát

## Database

- [ ] migration baseline tồn tại
- [ ] seed tồn tại
- [ ] có hướng dẫn reset DB
- [ ] member mới dựng được database

## API Contract

- [ ] success format thống nhất
- [ ] error format thống nhất
- [ ] unknown endpoint trả 404 chuẩn
- [ ] 500 không leak raw DB stack/object

## Authentication

- [ ] missing token -> 401
- [ ] invalid token -> 401
- [ ] expired token -> 401

## Authorization

- [ ] user không xem được `/orders/all`
- [ ] user không update order status
- [ ] user không chỉnh kho
- [ ] no-auth không chỉnh kho
- [ ] admin/staff policy hoạt động đúng

## Validation

- [ ] register validation
- [ ] login validation
- [ ] user profile/address validation
- [ ] cart validation
- [ ] product/order/inventory basic validation

## Frontend

- [ ] không hard-code `localhost:3000` ở core API calls
- [ ] current flows không bị regression

## Testing

- [ ] Postman collection có smoke suite
- [ ] Newman chạy bằng command
- [ ] report sinh được
- [ ] smoke suite pass 100%

---

# 16. Required Regression Scenarios

Trước merge Phase 1 phải manual/automated check:

### User

```text
register
login
profile
address
cart
checkout COD
my orders
```

### Admin

```text
login
list users
update role
product CRUD
category CRUD
view orders
update order status
```

### Staff

```text
login
view inventory
update inventory
view orders
update order status
```

### Negative

```text
no token
invalid token
wrong role
invalid body
invalid ID
not found resource
```

---

# 17. Known Debt intentionally deferred

Các issue sau **không được coi là thiếu Phase 1**, vì được đưa sang Phase 2+:

- createOrder transaction
- server-side total calculation
- oversell protection hoàn chỉnh
- repeated cancel protection
- order state machine
- audit trail
- goods receipt
- inventory movement
- account lock
- voucher
- dashboard
- MoMo IPN

Tuy nhiên, các test có thể đánh dấu chúng là:

```text
KNOWN GAP / EXPECTED FAIL
```

nếu team muốn chứng minh quá trình cải tiến.

---

# 18. Handoff sang Phase 2

Sau khi Phase 1 Done, Phase 2 có thể bắt đầu từ một API foundation ổn định.

Phase 2 nên bắt đầu bằng:

```text
OrderService
OrderRepository
Transaction boundary
Server-side pricing
Stock lock/check
State transition map
Order audit
```

Đây là dependency trực tiếp của các test State Transition và E2E trong `MASTER_TEST_PLAN.md`.

---

# 19. Kết luận

Phase 1 là phase quan trọng nhất về mặt nền móng.

Nó không tạo nhiều màn hình mới, nhưng giải quyết các điểm khiến project hiện tại khó kiểm thử và dễ sai dữ liệu:

```text
Auth
RBAC
Validation
API Contract
Error Handling
DB Reproducibility
Environment
Smoke Automation
```

Sau Phase 1, project mới thực sự sẵn sàng để phát triển các module nghiệp vụ phức tạp trong Scaling Plan.
