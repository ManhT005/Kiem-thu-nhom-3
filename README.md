# Kiem-thu-nhom-3 — Clothes Shop Testing Project

Đồ án môn **Kiểm thử phần mềm** xây dựng trên hệ thống bán quần áo Node.js/Express + MySQL + Vanilla JavaScript. Project được phát triển theo 6 phase, ưu tiên khả năng kiểm thử, tính toàn vẹn dữ liệu, RBAC, transaction, automated regression và release evidence.

## Trạng thái hiện tại

Development scope của **Phase 1 → Phase 6 đã hoàn tất và đã merge vào `develop`**.

Baseline hiện tại:

- `develop`: `4d42fd767ac949543edc26eb6fd3ac8efd798215`
- Node.js 22
- MySQL 8
- Express 4
- Automated CI: **Commerce Full Regression**
- External MoMo: **BLOCKED_EXTERNAL** cho đến khi có sandbox/public callback evidence thật
- Manual acceptance / release-owner sign-off: **PENDING**

CI trên merge commit hiện tại đã PASS:

| Layer | Result |
|---|---:|
| Unit | 57/57 PASS |
| Integration/MySQL | 43/43 PASS |
| Browser/Playwright | 11/11 PASS |
| API/Newman | 163 requests / 316 assertions PASS |
| Endpoint mapping | 62/62 |
| Runtime dependency audit | 0 high/critical vulnerabilities |

> Automated regression đã xanh. Phần còn lại của project tập trung vào review evidence, manual acceptance, external MoMo acceptance nếu có môi trường phù hợp, và quyết định release/demo.

## 6 phase của dự án

| Phase | Nội dung chính | Trạng thái |
|---|---|---|
| 1 | Stabilization, API contract, auth/validation foundation | Completed |
| 2 | Order integrity, transaction, state machine, idempotency | Completed |
| 3 | Inventory integrity, goods receipt, stock ledger | Completed |
| 4 | User lifecycle, RBAC, voucher | Completed |
| 5 | Dashboard reporting, payment reconciliation | Completed |
| 6 | Full regression, evidence, CI, release hardening | Completed — automated scope |

Ban đầu project có kế hoạch mở rộng thêm nhiều module độc lập. Sau quá trình triển khai, 6 phase hiện tại đã bao phủ toàn bộ scope cần thiết cho đồ án; không mở thêm phase chức năng mới trước khi chốt kiểm thử.

## Kiến trúc

```text
frontend/                 Vanilla JS multi-page UI
backend/
├── controllers/
├── domain/
├── middleware/
├── repositories/
├── routes/
├── services/
├── validators/
└── tests/
database/
├── migrations/
└── seeds/
tests/
├── browser/
└── postman/
docs/                     Plans, contracts, runbooks, RTM
reports/                  Execution reports, evidence indexes, defects
```

Luồng backend chính:

```text
Route
  -> Validation
  -> Authentication / RBAC
  -> Controller
  -> Service / Domain
  -> Repository
  -> MySQL
```

## Chạy project

### Yêu cầu

- Node.js 22
- npm
- MySQL 8

Cài dependencies:

```bash
npm ci
npm --prefix backend ci
```

Cấu hình environment dựa trên `backend/.env.example` nếu có và không commit secret thật.

Khởi tạo database theo migration:

```bash
npm run db:migrate
npm run db:migrate:status
```

> Deployment bình thường dùng migration. **Không dùng `db:reset` trên database thật.**

Chạy ứng dụng:

```bash
npm start
```

## Chạy kiểm thử

Full regression yêu cầu database test riêng có hậu tố `*_test`.

```bash
npm run db:reset
npm run db:seed:phase2
npm run test:all
```

Các layer chính:

```bash
npm run check
npm run test:unit
npm run test:integration
npm run test:api:managed
npm run test:browser
npm run test:evidence
```

CI tương ứng nằm tại:

```text
.github/workflows/commerce-regression.yml
```

## Tài liệu quan trọng

Bắt đầu từ [Documentation Index](docs/README.md).

Các tài liệu chính:

- [Master Test Plan](docs/MASTER_TEST_PLAN.md)
- [Project status](docs/PROJECT_STATUS.md)
- [Phase 5 reporting contract](docs/phase%205/PHASE_5_CONTRACT.md)
- [Phase 6 scope and contract baseline](docs/phase%206/PHASE_6_SCOPE_AND_CONTRACT_BASELINE.md)
- [Requirement Traceability Matrix](docs/phase%206/PHASE_6_REQUIREMENT_TRACEABILITY_MATRIX.md)
- [Release runbook](docs/phase%206/PHASE_6_RELEASE_RUNBOOK.md)
- [Release checklist](docs/phase%206/PHASE_6_RELEASE_CHECKLIST.md)
- [Phase 6 execution report](reports/PHASE_6_TEST_EXECUTION_REPORT.md)
- [CI evidence index](reports/PHASE_6_CI_EVIDENCE_INDEX.md)
- [Final acceptance status](reports/PHASE_6_FINAL_ACCEPTANCE_REPORT.md)

## Release policy

Một build chỉ được coi là release-ready khi:

1. Commerce Full Regression xanh trên candidate SHA.
2. Không có S1/S2 chưa xử lý.
3. Evidence và RTM đã review.
4. Manual acceptance được ký.
5. External MoMo phải có evidence thật hoặc được ghi rõ là demo-only / BLOCKED_EXTERNAL.
6. Release owner xác nhận GO trước khi merge/tag release.

Project hiện **không tuyên bố production-ready cho MoMo** nếu chưa hoàn tất external acceptance.
