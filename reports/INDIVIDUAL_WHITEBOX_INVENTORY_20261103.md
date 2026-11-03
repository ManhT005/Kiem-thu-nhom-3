# BÁO CÁO KIỂM THỬ HỘP TRẮNG CÁ NHÂN
## Kiểm thử hàm `applyMovement()` – module quản lý biến động tồn kho

- **Repository:** [ManhT005/Kiem-thu-nhom-3](https://github.com/ManhT005/Kiem-thu-nhom-3)
- **Nhánh cá nhân:** `individual/whitebox-inventory-20261103`
- **Commit được kiểm thử:** `bf95b30466fb12d7fe6e62c53773ac9536dcfc0d`
- **Ngày thực hiện:** 03/11/2026
- **Nguồn mã:** [backend/services/inventory.service.js](https://github.com/ManhT005/Kiem-thu-nhom-3/blob/develop/backend/services/inventory.service.js)
- **File test cá nhân:** [inventory-movement-whitebox-personal.test.js](https://github.com/ManhT005/Kiem-thu-nhom-3/blob/individual/whitebox-inventory-20261103/backend/tests/inventory-movement-whitebox-personal.test.js)

## 1. Mục tiêu và phạm vi

Phân tích luồng điều khiển của hàm `applyMovement(connection, input, repository)`, thiết kế các dữ liệu đầu vào kích hoạt nhánh hợp lệ và nhánh lỗi, thực hiện kiểm thử đơn vị và ghi nhận kết quả thực tế.

Hàm `applyMovement()` tạo các biến động tồn kho thuộc bốn loại: `ORDER`, `CANCEL`, `RECEIPT`, `ADJUSTMENT`. Phạm vi cá nhân gồm kiểm tra dữ liệu đầu vào, cặp loại sự kiện/tham chiếu, lý do, biến thể sản phẩm-kích cỡ, ledger trùng, số lượng tồn kho trước/sau biến động và kết quả cập nhật dữ liệu.

## 2. Phương pháp và môi trường

- Phương pháp: white-box testing, phân tích control-flow và decision/branch coverage, kết hợp kiểm thử giá trị biên.
- Test runner: `node:test`; assertion: `node:assert/strict`.
- Repository được giả lập để kiểm soát dữ liệu trả về và xác nhận thứ tự gọi `lockVariant`, `findMovement`, `ensureOpening`, `updateStock`, `insertMovement`.
- CI: GitHub Actions, Ubuntu 24.04, Node.js 22, MySQL 8 service.
- Không gọi MoMo provider thật. Các ca cá nhân không trực tiếp ghi database; database integration được kiểm tra riêng trong regression workflow.

## 3. Các điểm quyết định được phân tích

| Điểm | Nhánh/điều kiện | Kết quả cần kiểm tra |
|---|---|---|
| D0 | Chuẩn hóa `maSP`, `maSize`, `delta` | Hợp lệ hoặc `VALIDATION_ERROR` |
| D1 | `delta=0`, sai cặp event/reference, `referenceId` sai, chiều delta không hợp lệ theo loại sự kiện | Chấp nhận hoặc `INVALID_MOVEMENT` |
| D2 | `reason` rỗng hoặc dài trên 500 ký tự | `VALIDATION_ERROR` |
| D3 | Không tìm thấy biến thể | `INVENTORY_VARIANT_NOT_FOUND` |
| D4 | Biến thể ngừng hoạt động và event không phải CANCEL | `VARIANT_INACTIVE`; CANCEL vẫn được phép |
| D5–D6 | Tìm thấy ledger trùng; delta giống/khác | Idempotent hoặc `MOVEMENT_CONFLICT` |
| D7 | Tồn kho sau biến động nhỏ hơn 0 | `INSUFFICIENT_STOCK` |
| D8 | Tồn kho sau biến động vượt `MAX_STOCK` | `STOCK_OVERFLOW` |
| D9 | `updateStock` không trả đúng 1 dòng | `STOCK_UPDATE_FAILED`; không insert ledger |
| D10 | Đường đi hợp lệ | Ghi ledger và trả id, quantityAfter, duplicate=false |

## 4. Ma trận 23 ca kiểm thử

| ID | Mục tiêu/nhánh | Dữ liệu chính | Kết quả kỳ vọng |
|---|---|---|---|
| WB-INV-01 | ORDER hợp lệ | Tồn 5, delta -2 | Tồn còn 3, ghi ledger |
| WB-INV-02 | RECEIPT hợp lệ | Tồn 5, delta +4 | Tồn thành 9, ghi ledger |
| WB-INV-03 | CANCEL khi biến thể ngừng bán | is_active=0, delta +1 | Cho phép hoàn tồn lên 3 |
| WB-INV-04 | ADJUSTMENT hợp lệ | Tồn 5, delta +1 | Tồn thành 6 |
| WB-INV-05 | delta bằng 0 | delta=0 | INVALID_MOVEMENT, không gọi repository |
| WB-INV-06 | Sai loại tham chiếu | ORDER + GOODS_RECEIPT | INVALID_MOVEMENT |
| WB-INV-07 | referenceId sai định dạng | `bad reference!` | INVALID_MOVEMENT |
| WB-INV-08 | ORDER tăng tồn | ORDER, delta=+1 | INVALID_MOVEMENT |
| WB-INV-09 | CANCEL giảm tồn | CANCEL, delta=-1 | INVALID_MOVEMENT |
| WB-INV-10 | RECEIPT giảm tồn | RECEIPT, delta=-1 | INVALID_MOVEMENT |
| WB-INV-11 | reason rỗng | Chỉ có dấu cách | VALIDATION_ERROR |
| WB-INV-12 | Biến thể không tồn tại | lockVariant trả null | INVENTORY_VARIANT_NOT_FOUND |
| WB-INV-13 | ORDER trên biến thể inactive | is_active=0 | VARIANT_INACTIVE |
| WB-INV-14 | Ledger trùng cùng delta | Đã có delta=-2 | Trả bản ghi cũ; duplicate=true; không ghi mới |
| WB-INV-15 | Ledger trùng khác delta | Đã có delta=-1, yêu cầu -2 | MOVEMENT_CONFLICT |
| WB-INV-16 | Thiếu tồn kho | Tồn 1, delta=-2 | INSUFFICIENT_STOCK; không ghi dữ liệu |
| WB-INV-17 | Tràn tồn kho | Tồn MAX_STOCK, delta=+1 | STOCK_OVERFLOW |
| WB-INV-18 | Cập nhật tồn kho thất bại | updateStock trả 0 | STOCK_UPDATE_FAILED; không insert ledger |
| WB-INV-19 | Chuẩn hóa kiểu dữ liệu | maSP="7", maSize="2", delta="-2", referenceId=123 | Chuẩn hóa và xử lý thành công |
| WB-INV-20 | Mã sản phẩm không phải số nguyên | maSP="7 OR 1=1" | VALIDATION_ERROR |
| WB-INV-21 | Mã kích cỡ dưới cận | maSize=0 | VALIDATION_ERROR |
| WB-INV-22 | delta vượt giới hạn | delta=MAX_STOCK+1 | VALIDATION_ERROR |
| WB-INV-23 | reason quá dài | 501 ký tự | VALIDATION_ERROR |

## 5. Kết quả thực thi

**Kết quả bộ test cá nhân: 23/23 PASS, 0 FAIL, 0 SKIP.**

Bằng chứng: [GitHub Actions – Commerce Full Regression, run #44](https://github.com/ManhT005/Kiem-thu-nhom-3/actions/runs/41651320208).

Kết quả regression toàn dự án trên cùng commit:

| Hạng mục | Kết quả |
|---|---:|
| Syntax check | PASS |
| Unit tests backend | 80/80 PASS |
| Bộ test cá nhân applyMovement | 23/23 PASS |
| Integration (MySQL 8) | 43/43 PASS |
| API regression | 163 requests, 316 assertions, 0 lỗi |
| Browser / Playwright | 11/11 PASS |
| Endpoint mapping | 62/62 |
| Evidence gate | PASS |
| Runtime dependency security gate | PASS |
| Toàn bộ workflow | **SUCCESS** |

## 6. Độ bao phủ mã nguồn

Coverage được đo riêng bằng lệnh:

```bash
cd backend
node --experimental-test-coverage --test tests/inventory-movement-whitebox-personal.test.js
```

Kết quả:

| Tệp/phạm vi đo | Line | Branch | Function |
|---|---:|---:|---:|
| `services/inventory.service.js` (hàm mục tiêu) | **100.00%** | **100.00%** | **100.00%** |
| Tổng các tệp được nạp trong phiên test | 82.25% | 96.51% | 80.36% |

Các tệp phụ trợ có coverage thấp hơn do bộ test dùng fake repository, không gọi toàn bộ hàm nội bộ của repository và domain. Các tỷ lệ trên là coverage của phiên test cá nhân và các tệp được nạp, **không phải coverage toàn repository hoặc frontend**.

## 7. Đánh giá và giới hạn

1. 23 ca đã kích hoạt các nhánh hợp lệ, nhánh từ chối, nhánh dữ liệu biên, trùng ledger, thiếu/tràn tồn và lỗi cập nhật.
2. Line/branch/function coverage của `inventory.service.js` đạt 100% trong phiên đo riêng.
3. Vì repository được mock, bộ test cá nhân không tự xác nhận locking, transaction, deadlock hoặc tính nhất quán khi nhiều giao dịch ghi database đồng thời. Đây là lý do vẫn cần integration tests trên MySQL 8.
4. Kết quả CI xanh không đồng nghĩa hệ thống đã được nghiệm thu production hay đã kiểm chứng giao dịch MoMo thật.

## 8. Kết luận

Đã hoàn thành thiết kế và thực thi 23 ca kiểm thử hộp trắng cho hàm `applyMovement()`. Bộ test cá nhân đạt 23/23 PASS và đạt 100% line, branch, function coverage đối với tệp dịch vụ được chọn. Workflow regression trên commit được kiểm thử thành công; kết quả và giới hạn được ghi rõ để phục vụ tổng hợp báo cáo cá nhân.

**Các liên kết để đối chiếu:**
- [Mã kiểm thử 23 ca](https://github.com/ManhT005/Kiem-thu-nhom-3/blob/individual/whitebox-inventory-20261103/backend/tests/inventory-movement-whitebox-personal.test.js)
- [Workflow và log chạy](https://github.com/ManhT005/Kiem-thu-nhom-3/actions/runs/41651320208)
- [Nhánh cá nhân](https://github.com/ManhT005/Kiem-thu-nhom-3/tree/individual/whitebox-inventory-20261103)
