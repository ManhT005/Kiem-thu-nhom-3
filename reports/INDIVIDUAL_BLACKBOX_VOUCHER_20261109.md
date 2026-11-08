# BÁO CÁO KIỂM THỬ HỘP ĐEN CÁ NHÂN
## API xem trước Voucher và tính toán giảm giá

- **Dự án:** Clothes Shop – ManhT005/Kiem-thu-nhom-3
- **Phạm vi cá nhân:** `POST /api/vouchers/validate` và quyền tạo voucher qua `/api/admin/vouchers`
- **Nhánh:** `individual/blackbox-voucher-20261109`
- **Commit thực thi:** `99896a11dec0ff2302af6bf9bc01b5477f5ca2f5`
- **Ngày thực thi:** 09/11/2026
- **Người thực hiện:** ........................................................
- **Mã sinh viên / Lớp:** ....................................................

## 1. Mục tiêu

Thực hiện kiểm thử hộp đen đối với chức năng kiểm tra khả năng áp dụng voucher. Việc kiểm thử xuất phát từ yêu cầu nghiệp vụ và hợp đồng API, gửi dữ liệu qua HTTP, sau đó đánh giá mã trạng thái, mã lỗi, nội dung phản hồi và trạng thái sử dụng voucher quan sát được từ API quản trị.

Các ca kiểm thử không gọi trực tiếp hàm trong backend, không dùng cấu trúc `if/else` làm tiêu chí thiết kế và không truy vấn trực tiếp database trong mã test cá nhân. Đây là điểm khác biệt với bài kiểm thử hộp trắng đã thực hiện trước đó.

## 2. Cơ sở thiết kế và phạm vi

Tài liệu làm cơ sở:
- [Master Test Plan](https://github.com/ManhT005/Kiem-thu-nhom-3/blob/develop/docs/MASTER_TEST_PLAN.md): xác định kiểm thử hộp đen, EP, BVA, decision table, RBAC và quy trình API.
- [Phase 4 Test Plan](https://github.com/ManhT005/Kiem-thu-nhom-3/blob/develop/docs/phase%204/PHASE_4_TEST_PLAN.md): xác định các trường hợp voucher theo thời hạn, giá trị tối thiểu, giới hạn toàn hệ thống/theo người dùng và điều kiện từ chối.
- [Phase 4 Postman Collection](https://github.com/ManhT005/Kiem-thu-nhom-3/blob/develop/tests/postman/Phase4.postman_collection.json): tham chiếu cấu trúc request, tài khoản fixture và hành vi preview.

Phạm vi trực tiếp:
- `POST /api/vouchers/validate`: người mua gửi mã voucher và danh sách sản phẩm/kích cỡ/số lượng để xem trước giá trị giảm.
- `POST /api/admin/vouchers`: quản trị viên tạo voucher để chuẩn bị dữ liệu kiểm thử.
- `GET /api/admin/vouchers?code=...`: đọc số lượt đã sử dụng qua giao diện API quản trị nhằm xác minh preview không tiêu thụ lượt.

Không nằm trong phạm vi cá nhân này: kiểm thử hiệu năng tải lớn, thanh toán MoMo thật, đánh giá giao diện trực quan toàn diện, kiểm thử đồng thời nhiều giao dịch và kiểm thử xâm nhập chuyên sâu.

## 3. Phương pháp kiểm thử

| Kỹ thuật | Cách áp dụng |
|---|---|
| Phân vùng tương đương (EP) | Chia mã voucher thành hợp lệ, sai định dạng, không tồn tại; người gọi thành khách hàng, nhân viên, quản trị viên; trạng thái voucher thành đang hiệu lực, chưa bắt đầu, hết hạn, bị tắt, hết lượt |
| Phân tích giá trị biên (BVA) | Kiểm tra đơn hàng đúng ngưỡng 3.000 VND và thấp hơn điều kiện đúng 1 VND; mức giảm phần trăm 0%, 100% và vượt 100%; số lượng mua bằng 0 |
| Bảng quyết định | Kết hợp thời hạn, trạng thái bật/tắt, giá trị tối thiểu và giới hạn lượt để xác định có được áp dụng hay không |
| Kiểm thử phân quyền | Gửi request bằng token khách hàng, nhân viên, quản trị viên và không gửi token |
| Kiểm thử giá trị đầu ra | Đối chiếu subtotal, số tiền giảm, tổng sau giảm; thử gửi giá/total giả để xác nhận server tính theo dữ liệu sản phẩm |
| Kiểm thử tính không gây tác dụng phụ | Gửi preview lặp lại, sau đó đọc `used_count` qua API quản trị |

## 4. Môi trường và dữ liệu kiểm thử

- Runner: GitHub Actions, Ubuntu 24.04.
- Runtime: Node.js 22.
- Database: MySQL 8, database kiểm thử riêng `clothes_test`.
- Công cụ: Playwright APIRequestContext, chạy trong bước `npm run test:browser`.
- Base URL: `http://127.0.0.1:3000` do Playwright webServer khởi chạy.
- Tài khoản thử nghiệm được seed sẵn: Admin, Staff và User A (chỉ sử dụng trong DB test).
- Sản phẩm fixture: `maSP=93003`, `maSize=92901`; giá máy chủ trả về cho một sản phẩm là 3.000 VND.
- Voucher: được tạo qua API quản trị bằng mã động, thời gian hiệu lực và giới hạn sử dụng tùy từng ca.

Trong các request preview, test cố ý truyền `subtotal=1` và `gia=1` trong payload để kiểm tra kết quả trả về có sử dụng giá thực của biến thể sản phẩm hay không.

## 5. Danh sách 26 ca kiểm thử hộp đen

| ID | Tình huống | Đầu vào / điều kiện | Kết quả mong đợi |
|---|---|---|---|
| BB-V-01 | Preview không đăng nhập | Không có token | 401 – UNAUTHENTICATED |
| BB-V-02 | Nhân viên gọi preview của khách | Staff token | 403 – FORBIDDEN |
| BB-V-03 | Khách tạo voucher quản trị | User token gọi POST admin vouchers | 403 – FORBIDDEN |
| BB-V-04 | Nhân viên tạo voucher quản trị | Staff token gọi POST admin vouchers | 403 – FORBIDDEN |
| BB-V-05 | Thiếu mã voucher | Không gửi voucherCode | 400 – VALIDATION_ERROR |
| BB-V-06 | Mã voucher sai định dạng | `bad code!` | 400 – VALIDATION_ERROR |
| BB-V-07 | Mã đúng định dạng nhưng không tồn tại | Mã động chưa được tạo | 404 – VOUCHER_NOT_FOUND |
| BB-V-08 | Danh sách mặt hàng rỗng | items = [] | 400 – VALIDATION_ERROR |
| BB-V-09 | Số lượng bằng 0 | soLuongMua = 0 | 400 – VALIDATION_ERROR |
| BB-V-10 | Biến thể không tồn tại | Mã sản phẩm không có trong fixture | 404 – ORDER_VARIANT_NOT_FOUND |
| BB-V-11 | Lặp cùng sản phẩm và kích cỡ | Hai dòng có cùng maSP/maSize | 400 – VALIDATION_ERROR |
| BB-V-12 | Voucher cố định 500 VND | Subtotal/giá gửi từ client = 1 | 200; subtotal server = 3.000, giảm 500, còn 2.500 |
| BB-V-13 | Đơn đúng ngưỡng tối thiểu | minimumOrderAmount = 3.000 | 200 – được áp dụng |
| BB-V-14 | Ngưỡng cao hơn subtotal 1 VND | minimumOrderAmount = 3.001 | 409 – MIN_ORDER_NOT_MET |
| BB-V-15 | Mức giảm cố định lớn hơn đơn | discountValue = 5.000, subtotal = 3.000 | Giảm tối đa 3.000, tổng còn 0 |
| BB-V-16 | Voucher giảm 10% | discountValue = 10 | Giảm 300, tổng còn 2.700 |
| BB-V-17 | Áp dụng mức giảm tối đa | 50%, maximumDiscountAmount = 100 | Giảm 100, tổng còn 2.900 |
| BB-V-18 | Biên trên phần trăm | 100% | Được chấp nhận, giảm 3.000 |
| BB-V-19 | Biên dưới phần trăm không hợp lệ | 0% | Tạo voucher bị từ chối, 400 |
| BB-V-20 | Vượt biên phần trăm | 100,01% | Tạo voucher bị từ chối, 400 |
| BB-V-21 | Voucher chưa đến thời điểm bắt đầu | startAt ở tương lai | 409 – VOUCHER_NOT_STARTED |
| BB-V-22 | Voucher đã hết hạn | endAt ở quá khứ | 409 – VOUCHER_EXPIRED |
| BB-V-23 | Voucher bị vô hiệu hóa | enabled = false | 409 – VOUCHER_DISABLED |
| BB-V-24 | Hết lượt dùng toàn hệ thống | usageLimit = 0 | 409 – VOUCHER_USAGE_LIMIT |
| BB-V-25 | Hết lượt dùng theo người mua | perUserLimit = 0 | 409 – VOUCHER_USER_LIMIT |
| BB-V-26 | Preview nhiều lần không trừ lượt | Gọi preview 3 lần với voucher usageLimit=1 | Cả 3 request thành công; used_count vẫn bằng 0 |

**Quy tắc đánh giá:** mã HTTP và mã lỗi là tiêu chí chính đối với nhánh từ chối; với nhánh thành công, kiểm tra thêm các giá trị subtotalBeforeDiscount, discountAmount, totalAfterDiscount và used_count. Mỗi ca tạo voucher dùng mã riêng để tránh ảnh hưởng lẫn nhau.

## 6. Kết quả thực thi

**Bộ kiểm thử hộp đen cá nhân: 26/26 PASS, 0 FAIL.**

Bằng chứng chạy: [GitHub Actions – run #52](https://github.com/ManhT005/Kiem-thu-nhom-3/actions/runs/42504893040). Workflow trên commit `99896a11dec0ff2302af6bf9bc01b5477f5ca2f5` có trạng thái **SUCCESS**.

Kết quả regression tổng thể cùng commit:

| Hạng mục | Kết quả |
|---|---:|
| Kiểm tra cú pháp | PASS |
| Unit test backend | 80/80 PASS |
| Bộ hộp đen cá nhân | **26/26 PASS** |
| Integration test với MySQL 8 | 43/43 PASS |
| API regression | 163 requests, 316 assertions, 0 failures |
| Browser / Playwright toàn bộ | 37/37 PASS |
| Endpoint mapping | 62/62 |
| Evidence gate | PASS |
| Runtime dependency security gate | PASS |
| GitHub Actions workflow | **SUCCESS** |

Các con số Unit, Integration, API và Browser ở trên là kết quả regression của toàn dự án trong cùng workflow; riêng số liệu 26/26 là phạm vi test cá nhân.

## 7. Đánh giá và giới hạn

1. Các lớp dữ liệu quan trọng của API voucher đã được kiểm tra bằng quan sát từ bên ngoài: phân quyền, định dạng input, voucher không tồn tại, giá trị giảm, ngưỡng đơn, thời gian, trạng thái và giới hạn sử dụng.
2. Ca BB-V-12 chứng minh server không tin subtotal/giá do client gửi: dù payload khai báo 1 VND, phản hồi dùng subtotal 3.000 VND từ biến thể fixture.
3. Ca BB-V-26 xác nhận thao tác preview chỉ xem trước, không tiêu thụ lượt voucher.
4. Fixture có subtotal đúng 3.000 VND, do đó bộ ca kiểm tra đơn đúng ngưỡng 3.000 và trường hợp ngưỡng là 3.001 VND. Bộ cá nhân chưa tạo được fixture sản phẩm có giá 2.999 VND để chạy thêm phía dưới của cùng ngưỡng.
5. Đây là kiểm thử hộp đen API, không đo line/branch coverage. Bộ test cá nhân không đọc database trực tiếp và không kiểm tra concurrency. Các test tích hợp hiện có của repository thực hiện thêm một phần kiểm tra database và tính toàn vẹn.
6. Kết quả không chứng minh hệ thống đã được kiểm thử tải lớn hoặc thanh toán MoMo production.

## 8. Kết luận

Đã thiết kế và thực thi 26 ca kiểm thử hộp đen cho API preview voucher và API tạo voucher quản trị. Tất cả 26 ca đều PASS trên CI. Các kết quả phản hồi phù hợp với những phân vùng và giá trị biên đã đặt ra trong phạm vi này. Workflow regression của dự án cũng hoàn thành SUCCESS trên commit đã nêu.

## 9. Liên kết mã nguồn và bằng chứng

- [Mã test hộp đen 26 ca](https://github.com/ManhT005/Kiem-thu-nhom-3/blob/individual/blackbox-voucher-20261109/tests/browser/individual-blackbox-voucher.spec.cjs)
- [Báo cáo Markdown](https://github.com/ManhT005/Kiem-thu-nhom-3/blob/individual/blackbox-voucher-20261109/reports/INDIVIDUAL_BLACKBOX_VOUCHER_20261109.md)
- [Nhánh cá nhân](https://github.com/ManhT005/Kiem-thu-nhom-3/tree/individual/blackbox-voucher-20261109)
- [GitHub Actions – run #52](https://github.com/ManhT005/Kiem-thu-nhom-3/actions/runs/42504893040)
- [Master Test Plan](https://github.com/ManhT005/Kiem-thu-nhom-3/blob/develop/docs/MASTER_TEST_PLAN.md)
- [Phase 4 Test Plan](https://github.com/ManhT005/Kiem-thu-nhom-3/blob/develop/docs/phase%204/PHASE_4_TEST_PLAN.md)
