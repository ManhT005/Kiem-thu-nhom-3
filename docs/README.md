# Documentation Index

Tài liệu trong repository được chia thành ba nhóm: **current project status**, **phase specifications/implementation**, và **test/release evidence**.

## 1. Nên đọc trước

1. [README dự án](../README.md)
2. [Current Project Status](PROJECT_STATUS.md)
3. [Master Test Plan](MASTER_TEST_PLAN.md)
4. [Phase 6 Requirement Traceability Matrix](phase%206/PHASE_6_REQUIREMENT_TRACEABILITY_MATRIX.md)
5. [Phase 6 Test Execution Report](../reports/PHASE_6_TEST_EXECUTION_REPORT.md)
6. [Release Checklist](phase%206/PHASE_6_RELEASE_CHECKLIST.md)

## 2. Current status

- [PROJECT_STATUS.md](PROJECT_STATUS.md) — trạng thái hiện tại sau khi Phase 1–6 được merge.
- [01_CURRENT_PROJECT_ASSESSMENT.md](01_CURRENT_PROJECT_ASSESSMENT.md) — đánh giá baseline ban đầu; giữ lại như tài liệu lịch sử.
- [02_UPDATE_ROADMAP.md](02_UPDATE_ROADMAP.md) — roadmap ban đầu; các phase chức năng hiện đã hoàn tất.
- [PROJECT_SCALING_PLAN.md](PROJECT_SCALING_PLAN.md) — định hướng scale ban đầu.

Các file assessment/roadmap cũ vẫn hữu ích để chứng minh tiến trình dự án, nhưng **không nên dùng chúng làm nguồn trạng thái hiện tại**.

## 3. Phase documents

### Phase 1 — Stabilization
- [Stabilization Plan](phase%201/03_PHASE_1_STABILIZATION_PLAN.md)

### Phase 2 — Order integrity
- [Test Plan](phase%202/PHASE_2_TEST_PLAN.md)
- [Implementation Notes](phase%202/PHASE_2_IMPLEMENTATION_NOTES.md)
- [Closure/Fix documents](phase%202/)

### Phase 3 — Inventory integrity
- [Implementation](phase%203/PHASE_3_IMPLEMENTATION.md)
- [Test Plan](phase%203/PHASE_3_TEST_PLAN.md)

### Phase 4 — User lifecycle, RBAC, voucher
- [Implementation](phase%204/PHASE_4_IMPLEMENTATION.md)
- [Test Plan](phase%204/PHASE_4_TEST_PLAN.md)
- [RBAC Matrix](phase%204/RBAC_MATRIX.md)

### Phase 5 — Reporting & payment reconciliation
- [Contract](phase%205/PHASE_5_CONTRACT.md)
- [Implementation](phase%205/PHASE_5_IMPLEMENTATION.md)
- [Test Plan](phase%205/PHASE_5_TEST_PLAN.md)
- [MoMo Sandbox Acceptance](phase%205/PHASE_5_MOMO_SANDBOX_ACCEPTANCE.md)

### Phase 6 — Regression & release hardening
- [Scope and Contract Baseline](phase%206/PHASE_6_SCOPE_AND_CONTRACT_BASELINE.md)
- [Master Test Plan](phase%206/PHASE_6_MASTER_TEST_PLAN.md)
- [Requirement Traceability Matrix](phase%206/PHASE_6_REQUIREMENT_TRACEABILITY_MATRIX.md)
- [System Acceptance Checklist](phase%206/PHASE_6_SYSTEM_ACCEPTANCE_CHECKLIST.md)
- [Release Checklist](phase%206/PHASE_6_RELEASE_CHECKLIST.md)
- [Release Runbook](phase%206/PHASE_6_RELEASE_RUNBOOK.md)

## 4. Reports and evidence

- [Phase 2 Test Report](../reports/PHASE_2_TEST_REPORT.md)
- [Phase 2 Closure Test Report](../reports/PHASE_2_CLOSURE_TEST_REPORT.md)
- [Phase 3 Test Report](../reports/PHASE_3_TEST_REPORT.md)
- [Phase 4 Test Report](../reports/PHASE_4_TEST_REPORT.md)
- [Phase 5 Test Report](../reports/PHASE_5_TEST_REPORT.md)
- [Phase 6 Test Execution Report](../reports/PHASE_6_TEST_EXECUTION_REPORT.md)
- [CI Evidence Index](../reports/PHASE_6_CI_EVIDENCE_INDEX.md)
- [Defect Register](../reports/PHASE_6_DEFECT_REGISTER.md)
- [Final Acceptance Status](../reports/PHASE_6_FINAL_ACCEPTANCE_REPORT.md)

## 5. Current release position

Automated scope is green on `develop@4d42fd767ac949543edc26eb6fd3ac8efd798215`.

Still pending:

- manual tester/reviewer acceptance;
- release-owner GO;
- external MoMo sandbox/public callback evidence if the team wants to claim verified external payment.

Therefore the project may be presented as **automated regression complete**, but external-payment production readiness must not be claimed yet.
