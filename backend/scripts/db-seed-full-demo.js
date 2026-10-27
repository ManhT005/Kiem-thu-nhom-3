/**
 * Complete, idempotent local DEMO dataset for ManhT005/Kiem-thu-nhom-3.
 * Requires MySQL 8 migrations 001..006. No schema changes; no destructive deletes.
 * Execute from backend/: node scripts/db-seed-full-demo.js
 * DO NOT USE WITH PRODUCTION DATA.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const TAG = "FULL_DEMO_SEED_V1";
const DEMO_PASSWORD = "Demo@123456";
const DB_NAME = process.env.DB_NAME || "";
if (!/_test$/i.test(DB_NAME)) throw new Error("Demo seed requires an explicit DB_NAME ending in _test; never seed a real database");
const SQL_DATE = (date) => date.toISOString().slice(0, 19).replace("T", " ");
const daysAgo = (days, hours = 12) => {
  const dt = new Date();
  dt.setUTCHours(hours, 0, 0, 0);
  dt.setUTCDate(dt.getUTCDate() - days);
  return SQL_DATE(dt);
};
const addDays = (timestamp, days) => SQL_DATE(new Date(Date.parse(timestamp.replace(" ", "T") + "Z") + days * 86400000));
const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
  throw new Error("Refusing to seed a production environment");
}
if (!/^[\w-]{1,64}$/.test(DB_NAME)) throw new Error("Invalid DB_NAME");

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: DB_NAME,
  decimalNumbers: true,
  timezone: "Z",
});
const stats = {};
const inc = (name) => { stats[name] = (stats[name] || 0) + 1; };
const rows = async (query, args = []) => (await db.execute(query, args))[0];
const first = async (query, args = []) => (await rows(query, args))[0] || null;
const exec = async (query, args = []) => (await db.execute(query, args))[0];
const selectOrCreate = async (label, select, selectArgs, insert, insertArgs, field) => {
  const found = await first(select, selectArgs);
  if (found) return found[field];
  const result = await exec(insert, insertArgs);
  inc(label);
  return result.insertId;
};

async function movement({ product, size, delta, event, type, ref, actor = null, why, when }) {
  const old = await first(
    "SELECT soLuongTon, is_active FROM ChiTietSanPham WHERE maSP=? AND maSize=? FOR UPDATE",
    [product, size],
  );
  assert(old, `Variant ${product}/${size} does not exist`);
  if (event !== "CANCEL") assert(old.is_active, `Inactive variant ${product}/${size}`);
  const existing = await first(
    "SELECT delta FROM InventoryMovement WHERE event_type=? AND reference_type=? AND reference_id=? AND maSP=? AND maSize=?",
    [event, type, String(ref), product, size],
  );
  if (existing) {
    assert(Number(existing.delta) === delta, `Movement idempotency conflict ${ref}`);
    return;
  }
  const after = Number(old.soLuongTon) + delta;
  assert(after >= 0, `Not enough stock ${product}/${size}: ${old.soLuongTon} + ${delta}`);
  const update = await exec(
    "UPDATE ChiTietSanPham SET soLuongTon=? WHERE maSP=? AND maSize=? AND soLuongTon=?",
    [after, product, size, old.soLuongTon],
  );
  assert(update.affectedRows === 1, "Stock changed concurrently, transaction rolled back");
  await exec(`INSERT INTO InventoryMovement
    (maSP,maSize,event_type,reference_type,reference_id,delta,quantity_before,quantity_after,actor_id,reason,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [product, size, event, type, String(ref), delta,
    old.soLuongTon, after, actor, why, when || daysAgo(1)]);
  inc("inventory movements");
}

const customerNames = [
  "Nguyễn Minh Anh", "Trần Thu Hà", "Lê Quốc Bảo", "Phạm Ngọc Linh",
  "Đỗ Hoàng Nam", "Vũ Thùy Dương", "Bùi Gia Huy", "Ngô Mai Phương",
  "Hoàng Đức Long", "Đặng Bảo Trâm", "Phan Tuấn Kiệt", "Hồ Khánh Vy",
];
const categories = [
  "Thời trang nam", "Thời trang nữ", "Áo thun", "Áo sơ mi", "Áo khoác",
  "Hoodie", "Quần jeans", "Quần dài", "Chân váy", "Đầm và váy", "Unisex", "Hàng mới",
];
const catalog = [
  ["Áo thun nam basic cotton",159000,"ao-thun-nam.jpg",[0,2,11]],
  ["Áo thun nam form rộng",189000,"ao-thun-nam.jpg",[0,2,10]],
  ["Áo thun nam oversize",219000,"ao-thun-nam.jpg",[0,2]],
  ["Áo thun nữ cổ tròn",149000,"ao-thun-nu.jpg",[1,2,11]],
  ["Áo thun nữ dáng ôm",179000,"ao-thun-nu.jpg",[1,2]],
  ["Áo thun unisex pastel",199000,"ao-thun-nu.jpg",[2,10]],
  ["Sơ mi nam caro",329000,"so-mi-nam-caro.jpg",[0,3,11]],
  ["Sơ mi nam tay dài công sở",369000,"so-mi-nam-caro.jpg",[0,3]],
  ["Sơ mi nam dáng suông",299000,"so-mi-nam-caro.jpg",[0,3]],
  ["Sơ mi nữ trắng basic",299000,"so-mi-nu-dai.jpg",[1,3,11]],
  ["Sơ mi nữ dáng dài",349000,"so-mi-nu-dai.jpg",[1,3]],
  ["Sơ mi nữ thanh lịch",389000,"so-mi-nu-dai.jpg",[1,3]],
  ["Áo bomber nam đen",589000,"bomber-nam.jpg",[0,4,11]],
  ["Áo bomber nam kaki",649000,"bomber-nam.jpg",[0,4]],
  ["Áo khoác unisex bomber",629000,"bomber-nam.jpg",[4,10]],
  ["Áo hoodie đen unisex",429000,"hoodie-den.jpg",[5,10,11]],
  ["Áo hoodie nỉ dáng rộng",469000,"hoodie-den.jpg",[5,10]],
  ["Áo hoodie basic mùa đông",399000,"hoodie-den.jpg",[5,10]],
  ["Quần jeans nam xanh",459000,"quan-jean-nam.jpg",[0,6,11]],
  ["Quần jeans nam ống đứng",499000,"quan-jean-nam.jpg",[0,6]],
  ["Quần jeans nam slim fit",529000,"quan-jean-nam.jpg",[0,6]],
  ["Quần jeans nữ xanh nhạt",429000,"quan-jean-nu.jpg",[1,6,11]],
  ["Quần jeans nữ ống rộng",479000,"quan-jean-nu.jpg",[1,6]],
  ["Quần jeans nữ cạp cao",509000,"quan-jean-nu.jpg",[1,6]],
  ["Quần dài nam casual",379000,"quan-jean-nam.jpg",[0,7]],
  ["Quần dài nữ đi làm",359000,"quan-jean-nu.jpg",[1,7]],
  ["Chân váy đen chữ A",289000,"chan-vay-den.jpg",[1,8,11]],
  ["Chân váy đen dáng ngắn",319000,"chan-vay-den.jpg",[1,8]],
  ["Chân váy đen công sở",339000,"chan-vay-den.jpg",[1,8]],
  ["Váy caro đỏ vintage",549000,"vay-caro-do.jpg",[1,9,11]],
  ["Đầm caro đỏ dáng dài",599000,"vay-caro-do.jpg",[1,9]],
  ["Váy caro đỏ dự tiệc",699000,"vay-caro-do.jpg",[1,9]],
  ["Áo thun nam phối sọc thể thao",229000,"ao-thun-nam.jpg",[0,2]],
  ["Áo thun nam cổ tim",179000,"ao-thun-nam.jpg",[0,2]],
  ["Áo thun nữ tay lỡ năng động",209000,"ao-thun-nu.jpg",[1,2]],
  ["Áo thun nữ oversize streetwear",239000,"ao-thun-nu.jpg",[1,2,10]],
  ["Áo thun unisex in chữ",249000,"ao-thun-nam.jpg",[2,10]],
  ["Áo polo nam tối giản",289000,"ao-thun-nam.jpg",[0,2,11]],
  ["Áo polo nữ cổ bẻ",279000,"ao-thun-nu.jpg",[1,2]],
  ["Áo thun nam thể thao thoáng khí",259000,"ao-thun-nam.jpg",[0,2]],
  ["Sơ mi nam Oxford xanh nhạt",399000,"so-mi-nam-caro.jpg",[0,3]],
  ["Sơ mi nam linen mùa hè",389000,"so-mi-nam-caro.jpg",[0,3]],
  ["Sơ mi nữ cổ V thanh lịch",359000,"so-mi-nu-dai.jpg",[1,3]],
  ["Sơ mi nữ họa tiết nhẹ",379000,"so-mi-nu-dai.jpg",[1,3]],
  ["Áo khoác bomber nam phối màu",679000,"bomber-nam.jpg",[0,4]],
  ["Áo khoác bomber nữ cá tính",659000,"bomber-nam.jpg",[1,4]],
  ["Áo khoác nam dáng rộng",719000,"bomber-nam.jpg",[0,4]],
  ["Áo khoác unisex street style",699000,"bomber-nam.jpg",[4,10]],
  ["Hoodie nam có mũ túi trước",479000,"hoodie-den.jpg",[0,5]],
  ["Hoodie nữ nỉ mềm",459000,"hoodie-den.jpg",[1,5]],
  ["Hoodie unisex dây rút",499000,"hoodie-den.jpg",[5,10]],
  ["Hoodie unisex basic xám",439000,"hoodie-den.jpg",[5,10]],
  ["Quần jeans nam wash xanh",549000,"quan-jean-nam.jpg",[0,6]],
  ["Quần jeans nam ống suông",579000,"quan-jean-nam.jpg",[0,6]],
  ["Quần jeans nữ skinny",489000,"quan-jean-nu.jpg",[1,6]],
  ["Quần jeans nữ baggy",539000,"quan-jean-nu.jpg",[1,6]],
  ["Quần dài nam dáng slim",419000,"quan-jean-nam.jpg",[0,7]],
  ["Quần dài nữ ống suông",419000,"quan-jean-nu.jpg",[1,7]],
  ["Quần dài unisex casual",449000,"quan-jean-nam.jpg",[7,10]],
  ["Chân váy nữ xếp ly",359000,"chan-vay-den.jpg",[1,8]],
  ["Chân váy nữ midi",399000,"chan-vay-den.jpg",[1,8]],
  ["Đầm nữ caro tay ngắn",629000,"vay-caro-do.jpg",[1,9]],
  ["Đầm nữ vintage dự tiệc",749000,"vay-caro-do.jpg",[1,9]],
  ["Váy nữ caro cổ vuông",649000,"vay-caro-do.jpg",[1,9]],
];

assert(catalog.length === 64, `Expected 64 clothing products, got ${catalog.length}`);
assert(new Set(catalog.map(([name]) => name)).size === 64, "Product names must be unique");

const contactAddresses = [
  "Số 12 Nguyễn Trãi, Thanh Xuân, Hà Nội", "Số 5 Cầu Giấy, Hà Nội",
  "Số 41 Nguyễn Văn Cừ, Long Biên, Hà Nội", "Số 78 Lê Lợi, Hà Đông, Hà Nội",
  "Số 15 Trần Duy Hưng, Cầu Giấy, Hà Nội", "Số 63 Tô Hiệu, Hà Đông, Hà Nội",
  "Số 20 Hoàng Quốc Việt, Cầu Giấy, Hà Nội", "Số 8 Kim Mã, Ba Đình, Hà Nội",
  "Số 19 Đại La, Hai Bà Trưng, Hà Nội", "Số 34 Lạc Long Quân, Tây Hồ, Hà Nội",
  "Số 53 Giải Phóng, Hoàng Mai, Hà Nội", "Số 6 Phạm Văn Đồng, Bắc Từ Liêm, Hà Nội",
];

try {
  await db.query("SET time_zone = '+00:00'");
  const lock = await first("SELECT GET_LOCK(?, 10) AS ok", [`seed:${DB_NAME}:${TAG}`]);
  assert(lock?.ok === 1, "Another full demo seed is running");
  try {
    const versions = await rows("SELECT name,state FROM schema_migrations WHERE name LIKE '00%_%' ORDER BY name");
    assert(versions.filter(v => v.state === "APPLIED").length >= 6 &&
      ["001_","002_","003_","004_","005_","006_"].every(prefix => versions.some(v => v.name.startsWith(prefix) && v.state === "APPLIED")),
    "Run migrations 001..006 first: npm run db:migrate (or db:reset on an isolated *_test DB)");

    await db.beginTransaction();
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
    const people = [
      ["Demo Quản trị viên", "demo-admin@example.test", "admin", "ACTIVE"],
      ["Demo Quản trị viên 2", "demo-admin2@example.test", "admin", "ACTIVE"],
      ["Demo Nhân viên kho", "demo-staff@example.test", "staff", "ACTIVE"],
      ["Demo Nhân viên bán hàng", "demo-staff2@example.test", "staff", "ACTIVE"],
      ...customerNames.map((n,i) => [n, `demo-customer${String(i+1).padStart(2,"0")}@example.test`, "user", i === 11 ? "LOCKED" : "ACTIVE"]),
    ];
    const userIDs = [];
    for (const [i, [name, email, role, status]] of people.entries()) {
      userIDs.push(await selectOrCreate("users",
        "SELECT id FROM users WHERE email=?", [email],
        "INSERT INTO users (ten,email,sdt,matKhau,role,status,token_version) VALUES (?,?,?,?,?,?,0)",
        [name,email,`09${String(12000000+i).padStart(8,"0")}`,hashedPassword,role,status], "id"));
    }
    const admins = userIDs[0], staff = userIDs[2], customers = userIDs.slice(4);

    const catIDs = [];
    for (const cat of categories) {
      catIDs.push(await selectOrCreate("categories", "SELECT maDanhMuc FROM danhMuc WHERE tenDanhMuc=? ORDER BY maDanhMuc LIMIT 1", [cat],
        "INSERT INTO danhMuc (tenDanhMuc) VALUES (?)", [cat], "maDanhMuc"));
    }
    const sizeNames = ["S","M","L","XL","XXL"];
    const sizeIDs = [];
    for (const size of sizeNames) {
      sizeIDs.push(await selectOrCreate("sizes", "SELECT maSize FROM `Size` WHERE tenSize=? ORDER BY maSize LIMIT 1", [size],
        "INSERT INTO `Size` (tenSize) VALUES (?)", [size], "maSize"));
    }
    const paymentIDs = {};
    for (const method of ["COD","BANK_TRANSFER","MOMO"]) {
      paymentIDs[method] = await selectOrCreate("payment methods", "SELECT maPTTT FROM phuongThucThanhToan WHERE tenPTTT=? ORDER BY maPTTT LIMIT 1", [method],
        "INSERT INTO phuongThucThanhToan (tenPTTT) VALUES (?)", [method], "maPTTT");
    }

    const products = [];
    for (const [i, [title, price, image, catIndexes]] of catalog.entries()) {
      const description = `[${TAG}:P${String(i+1).padStart(2,"0")}] ${title}. Chất liệu phù hợp mặc hằng ngày, có nhiều kích cỡ; dữ liệu dùng kiểm thử.`;
      const id = await selectOrCreate("products", "SELECT maSP FROM SanPham WHERE moTa=? ORDER BY maSP LIMIT 1", [description],
        "INSERT INTO SanPham (tenSP,gia,moTa,anhSP) VALUES (?,?,?,?)", [title, price, description, image], "maSP");
      products.push({ id, title, price, image });
      for (const k of catIndexes) {
        const linked = await first("SELECT maSP FROM SanPham_DanhMuc WHERE maSP=? AND maDanhMuc=?", [id, catIDs[k]]);
        if (!linked) { await exec("INSERT INTO SanPham_DanhMuc (maSP,maDanhMuc) VALUES (?,?)", [id,catIDs[k]]); inc("product category links"); }
      }
      const gallery = `/Asset/${image}`;
      if (!await first("SELECT maAnh FROM HinhAnh WHERE maSP=? AND link=?", [id,gallery])) {
        await exec("INSERT INTO HinhAnh (maSP,link) VALUES (?,?)", [id,gallery]); inc("gallery images");
      }
      for (const [j, sizeID] of sizeIDs.entries()) {
        const variant = await first("SELECT maSP FROM ChiTietSanPham WHERE maSP=? AND maSize=?", [id,sizeID]);
        if (variant) continue;
        const stock = (i%11===0 && j===4) ? 0 : (i%9===0 && j===3 ? 2 : 18 + ((i*11+j*7)%47));
        const isActive = !(i === 7 && j === 4);
        await exec("INSERT INTO ChiTietSanPham (maSP,maSize,soLuongTon,is_active) VALUES (?,?,?,?)", [id,sizeID,stock,isActive?1:0]);
        inc("product size variants");
        await exec(`INSERT INTO InventoryMovement
          (maSP,maSize,event_type,reference_type,reference_id,delta,quantity_before,quantity_after,reason,created_at)
          VALUES (?,?,'OPENING','OPENING',?,?,0,?,'DEMO_OPENING_BALANCE',?)`,
          [id,sizeID,`${id}:${sizeID}`,stock,stock,daysAgo(130)]);
        inc("inventory movements");
      }
    }

    // Shopping carts and saved shipping addresses. Only the seed-owned users are touched.
    for (let i=0; i<customers.length; i++) {
      const user = customers[i];
      for (let j=0; j<2; j++) {
        const address = j===0 ? contactAddresses[i] : `Địa chỉ phụ: ${17+i} Phố Huế, Hà Nội`;
        if (!await first("SELECT maDiaChi FROM DiaChi WHERE id=? AND tenDiaChi=?", [user,address])) {
          await exec("INSERT INTO DiaChi (id,tenDiaChi,macDinh) VALUES (?,?,?)",[user,address,j===0?1:0]); inc("addresses");
        }
      }
      if (i >= 8 || i === 11) continue;
      let cart = await first("SELECT maGioHang FROM GioHang WHERE userId=? ORDER BY maGioHang LIMIT 1",[user]);
      if (!cart) { const created=await exec("INSERT INTO GioHang (userId) VALUES (?)",[user]); cart={maGioHang:created.insertId}; inc("carts"); }
      for (let k=0;k<3;k++) {
        const p=products[(i*4+k)%products.length], sizeID=sizeIDs[(k+i)%3];
        if (!await first("SELECT maGioHang FROM ChiTietGioHang WHERE maGioHang=? AND maSP=? AND maSize=?",[cart.maGioHang,p.id,sizeID])) {
          await exec("INSERT INTO ChiTietGioHang (maGioHang,maSP,maSize,soLuongMua) VALUES (?,?,?,?)",[cart.maGioHang,p.id,sizeID,k+1]); inc("cart items");
        }
      }
    }

    // Promo codes: active, disabled, not-yet-active and expired use cases.
    const promoDefs = [
      ["DEMO10","PERCENT",10,100000,50000,100,5,1,-120,180],
      ["DEMO30K","FIXED",30000,200000,null,100,5,1,-120,180],
      ["DEMOVIP15","PERCENT",15,500000,150000,50,5,1,-120,120],
      ["DEMOFREESHIP","FIXED",25000,150000,null,100,5,1,-120,100],
      ["DEMOEXPIRED","PERCENT",20,100000,70000,20,2,1,-120,-3],
      ["DEMOFUTURE","PERCENT",25,100000,90000,30,1,1,3,90],
      ["DEMODISABLED","FIXED",40000,100000,null,20,1,0,-15,120],
    ];
    const voucherIDs = {};
    for (const [code,type,value,min,cap,limit,perUser,enabled,start,end] of promoDefs) {
      const startDate = daysAgo(-start), endDate = daysAgo(-end);
      const fullCode=code;
      voucherIDs[code] = await selectOrCreate("vouchers", "SELECT maGiamGia FROM GiamGia WHERE code=?", [fullCode],
        `INSERT INTO GiamGia (code,chietKhau,ngayBatDau,ngayKetThuc,moTa,discount_type,discount_value,
          minimum_order_amount,maximum_discount_amount,start_at,end_at,usage_limit,used_count,per_user_limit,enabled)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,0,?,?)`,
        [fullCode,type==="PERCENT"?value:0,startDate.slice(0,10),endDate.slice(0,10),
          `[${TAG}] Voucher ${code}`,type,value,min,cap,startDate,endDate,limit,perUser,enabled],"maGiamGia");
      if (!await first("SELECT id FROM VoucherAudit WHERE voucher_id=? AND operation='CREATE' AND actor_id=?",[voucherIDs[code],admins])) {
        await exec("INSERT INTO VoucherAudit (voucher_id,actor_id,operation,before_state,after_state) VALUES (?,?,'CREATE',NULL,?)",
          [voucherIDs[code],admins,JSON.stringify({code,type,value,min,cap,limit,enabled})]); inc("voucher audit");
      }
    }

    // Goods receipts: posted movements replenish stock; drafts do not affect the ledger.
    for (let i=0;i<6;i++) {
      const code=`DEMO-GR-${String(i+1).padStart(3,"0")}`;
      if (await first("SELECT maPhieuNhap FROM PhieuNhap WHERE maPhieu=?",[code])) continue;
      const posted=i<4, created=daysAgo(125-i*5), postedAt=posted?addDays(created,1):null;
      const receiptItems=[];
      for (let j=0;j<4;j++) {
        const p=products[(i*5+j*3+1)%products.length], s=sizeIDs[(i+j)%4], qty=8+i+j;
        const unit=Math.floor(p.price*0.6), amount=unit*qty;
        receiptItems.push({p:p.id,s,qty,unit,amount});
      }
      const total=receiptItems.reduce((s,it)=>s+it.amount,0);
      const result=await exec(`INSERT INTO PhieuNhap
        (maPhieu,status,ghiChu,created_by,posted_by,created_at,posted_at,total_amount,idempotency_key,request_hash)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [code,posted?"POSTED":"DRAFT",`[${TAG}] Phiếu nhập kho ${i+1}`,staff,posted?staff:null,created,postedAt,total,
          `FULLDEMO_GR_${i+1}`,sha(receiptItems)]);
      inc("goods receipts");
      for (const it of receiptItems) {
        await exec(`INSERT INTO ChiTietPhieuNhap
          (maPhieuNhap,maSP,maSize,soLuongNhap,donGiaNhap,line_total)
          VALUES (?,?,?,?,?,?)`,[result.insertId,it.p,it.s,it.qty,it.unit,it.amount]);
        inc("goods receipt items");
        if (posted) await movement({product:it.p,size:it.s,delta:it.qty,event:"RECEIPT",type:"GOODS_RECEIPT",ref:result.insertId,
          actor:staff,why:"DEMO_GOODS_RECEIPT_POSTED",when:postedAt});
      }
    }

    // Adjustment ledger entries: examples for inventory correction and shrinkage.
    const adjustmentDefs=[
      ["FULLDEMO_ADJ_1", "Kiểm kê bổ sung hàng thử nghiệm", [[3,1,5],[5,0,4]]],
      ["FULLDEMO_ADJ_2", "Hàng lỗi khi kiểm kho", [[4,2,-2],[6,1,-1]]],
      ["FULLDEMO_ADJ_3", "Điều chỉnh sai lệch kiểm kê", [[12,0,7],[10,1,-2]]],
      ["FULLDEMO_ADJ_4", "Hàng trưng bày", [[17,2,-3],[20,0,3]]],
    ];
    for (const [idx, [key,reason,variants]] of adjustmentDefs.entries()) {
      if (await first("SELECT adjustment_id FROM StockAdjustment WHERE actor_id=? AND idempotency_key=?",[staff,key])) continue;
      const when=daysAgo(101-idx*2);
      const adjustment=await exec("INSERT INTO StockAdjustment (actor_id,reason,idempotency_key,request_hash,created_at) VALUES (?,?,?,?,?)",
        [staff,`[${TAG}] ${reason}`,key,sha(variants),when]);
      inc("stock adjustments");
      for (const [pi,si,delta] of variants) await movement({product:products[pi].id,size:sizeIDs[si],delta,
        event:"ADJUSTMENT",type:"ADJUSTMENT",ref:adjustment.insertId,actor:staff,why:reason,when});
    }

    // Orders are uniquely keyed using OrderCheckoutRequest, so re-seeding never duplicates them.
    const stateList=["Hoàn thành","Đang giao","Đã xác nhận","Chờ xác nhận","Đã hủy"];
    for (let i=0;i<35;i++) {
      const buyerIndex=i%11, buyer=customers[buyerIndex], orderKey=`FULLDEMO_ORDER_${String(i+1).padStart(3,"0")}`;
      if (await first("SELECT order_id FROM OrderCheckoutRequest WHERE user_id=? AND idempotency_key=?",[buyer,orderKey])) continue;
      const status=stateList[i%5];
      const method=(i%6===0 || i%6===1)?"MOMO":(i%6===2?"BANK_TRANSFER":"COD");
      const methodId=paymentIDs[method];
      const isRefund=(status==="Đã hủy" && method==="MOMO" && i%2===0);
      const paidMomo=(method==="MOMO" && status!=="Đã hủy" && status!=="Chờ xác nhận");
      const payStatus=method!=="MOMO"?"NOT_REQUIRED":(isRefund?"REFUND_REQUIRED":paidMomo?"PAID":status==="Đã hủy"?"EXPIRED":"CANCELLED");
      // Avoid MOMO pending-payment expiration in an old synthetic data set.
      const effectiveMethod=(method==="MOMO" && status==="Chờ xác nhận")?"COD":method;
      const effectivePayStatus=effectiveMethod==="COD" && method==="MOMO"?"NOT_REQUIRED":payStatus;
      const placed=daysAgo(89-Math.round(i*2.55));
      const items=[];
      for (let j=0;j<(i%3===0?3:2);j++) {
        const p=products[(i*3+j*7)%products.length], size=sizeIDs[(i+j)%3], qty=1+(i+j)%3;
        items.push({p:p.id,size,qty,price:p.price});
      }
      const subtotal=items.reduce((sum,it)=>sum+it.qty*it.price,0);
      const voucherCode=i%5===0?"DEMO10":i%7===0?"DEMO30K":i%11===0?"DEMOVIP15":null;
      const voucher=promoDefs.find(v=>v[0]===voucherCode);
      let discount=0;
      if (voucher && subtotal>=voucher[3]) {
        discount=voucher[1]==="PERCENT"?Math.floor(subtotal*voucher[2]/100):voucher[2];
        if (voucher[4]!==null) discount=Math.min(discount,voucher[4]);
        discount=Math.min(discount,subtotal);
      }
      const usedVoucher=discount>0?voucherCode:null;
      const fee=subtotal>=500000?0:30000;
      const total=subtotal-discount+fee;
      const email=people[buyerIndex+4][1], name=people[buyerIndex+4][0];
      const address=await first("SELECT maDiaChi FROM DiaChi WHERE id=? AND macDinh=1 ORDER BY maDiaChi LIMIT 1",[buyer]);
      const order=await exec(`INSERT INTO DonHang
        (ngayDat,trangThai,ghiChu,tenNguoiNhan,sdt,email,diaChiGiaoHang,phiGiaoHang,tongTien,
         maPTTT,id,maDiaChi,maGiamGia,payment_status,payment_expires_at,
         subtotal_before_discount,discount_amount,voucher_code_snapshot)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [placed,status,`[${TAG}] Đơn thử nghiệm ${String(i+1).padStart(3,"0")}`,
         name,`09${String(12000004+buyerIndex).padStart(8,"0")}`,email,contactAddresses[buyerIndex],fee,total,
         paymentIDs[effectiveMethod],buyer,address?.maDiaChi||null,usedVoucher?voucherIDs[usedVoucher]:null,
         effectivePayStatus,null,subtotal,discount,usedVoucher]);
      const orderID=order.insertId;
      inc("orders");
      for (const it of items) {
        await exec("INSERT INTO ChiTietDonHang (maDonHang,maSP,maSize,soLuongMua,giaMua) VALUES (?,?,?,?,?)",
          [orderID,it.p,it.size,it.qty,it.price]); inc("order items");
        await movement({product:it.p,size:it.size,delta:-it.qty,event:"ORDER",type:"ORDER",ref:orderID,
          actor:buyer,why:"ORDER_CREATED",when:placed});
      }
      const steps=[[null,"Chờ xác nhận",placed]];
      if (status==="Đã hủy") steps.push(["Chờ xác nhận","Đã hủy",addDays(placed,1)]);
      if (["Đã xác nhận","Đang giao","Hoàn thành"].includes(status)) steps.push(["Chờ xác nhận","Đã xác nhận",addDays(placed,1)]);
      if (["Đang giao","Hoàn thành"].includes(status)) steps.push(["Đã xác nhận","Đang giao",addDays(placed,2)]);
      if (status==="Hoàn thành") steps.push(["Đang giao","Hoàn thành",addDays(placed,4)]);
      for (const [from,to,when] of steps) {
        await exec("INSERT INTO LichSuDonHang (maDonHang,trangThaiCu,trangThaiMoi,nguoiThayDoi,lyDo,thoiGian) VALUES (?,?,?,?,?,?)",
          [orderID,from,to,from===null?buyer:staff,"DEMO_ORDER_STATE",when]); inc("order history");
      }
      if (status==="Đã hủy") for (const it of items) {
        await movement({product:it.p,size:it.size,delta:it.qty,event:"CANCEL",type:"ORDER",ref:orderID,
          actor:staff,why:"DEMO_ORDER_CANCELLED",when:addDays(placed,1)});
      }
      if (usedVoucher) {
        const redemptionStatus=status==="Đã hủy"?(isRefund?"COMMITTED":"RELEASED"):
          (status==="Hoàn thành" || paidMomo?"COMMITTED":"RESERVED");
        await exec(`INSERT INTO VoucherRedemption
          (voucher_id,order_id,user_id,discount_amount,status,created_at,released_at)
          VALUES (?,?,?,?,?,?,?)`,
          [voucherIDs[usedVoucher],orderID,buyer,discount,redemptionStatus,placed,
            redemptionStatus==="RELEASED"?addDays(placed,1):null]);
        inc("voucher redemptions");
        if (redemptionStatus!=="RELEASED") await exec("UPDATE GiamGia SET used_count=used_count+1 WHERE maGiamGia=?",[voucherIDs[usedVoucher]]);
      }
      if (effectiveMethod==="MOMO") {
        const txStatus=effectivePayStatus==="PAID" || effectivePayStatus==="REFUND_REQUIRED"?"PAID":"EXPIRED";
        const transID=txStatus==="PAID"?String(91000000000+i):null;
        await exec(`INSERT INTO MomoPaymentTransaction
          (maDonHang,provider_order_id,request_id,amount,status,trans_id,pay_url,expires_at,created_at,updated_at)
          VALUES (?,?,?,?,?,?,NULL,?,?,?)`,
          [orderID,`DEMO-MOMO-${orderID}`,`DEMO-REQ-${orderID}`,total,txStatus,transID,
            addDays(placed,1),placed,addDays(placed,1)]);
        inc("mock MoMo transactions");
      }
      await exec("INSERT INTO OrderCheckoutRequest (user_id,idempotency_key,request_hash,order_id,created_at) VALUES (?,?,?,?,?)",
        [buyer,orderKey,sha({tag:TAG,items,subtotal,discount,total,effectiveMethod}),orderID,placed]);
      inc("checkout keys");
    }

    // Demo lifecycle log. Existing rows are left untouched on re-run.
    const lifeExamples=[
      [customers[11],admins,"LOCK","DEMO_ACCOUNT_LOCKED",{status:"ACTIVE"},{status:"LOCKED"}],
      [customers[3],admins,"UNLOCK","DEMO_ACCOUNT_UNLOCKED",{status:"LOCKED"},{status:"ACTIVE"}],
      [customers[5],admins,"ROLE","DEMO_ROLE_REVIEW",{role:"user"},{role:"user"}],
    ];
    for(const [user,actor,op,reason,before,after] of lifeExamples) {
      if (!await first("SELECT id FROM UserLifecycleAudit WHERE user_id=? AND reason=?",[user,reason])) {
        await exec("INSERT INTO UserLifecycleAudit (user_id,actor_id,operation,reason,before_state,after_state,created_at) VALUES (?,?,?,?,?,?,?)",
          [user,actor,op,reason,JSON.stringify(before),JSON.stringify(after),daysAgo(5)]); inc("user lifecycle audits");
      }
    }

    // Reconciliation: each demo stock snapshot should agree with its stock ledger.
    const [discrepancy] = await rows(`SELECT ct.maSP,ct.maSize,ct.soLuongTon,COALESCE(SUM(m.delta),0) AS ledger
       FROM ChiTietSanPham ct JOIN SanPham p ON p.maSP=ct.maSP
       LEFT JOIN InventoryMovement m ON m.maSP=ct.maSP AND m.maSize=ct.maSize
       WHERE p.moTa LIKE ?
       GROUP BY ct.maSP,ct.maSize,ct.soLuongTon
       HAVING ct.soLuongTon <> ledger LIMIT 1`, [`[${TAG}%`]);
    assert(!discrepancy, `Stock ledger mismatch on product ${discrepancy?.maSP} size ${discrepancy?.maSize}`);

    await db.commit();
    console.log(`\n✓ Full demo seed applied to MySQL database: ${DB_NAME}`);
    for(const [label,num] of Object.entries(stats)) console.log(`  ${label}: +${num}`);
    if (!Object.keys(stats).length) console.log("  Nothing added: all demo records already exist.");
    console.log("\nDemo login credentials (local testing ONLY):");
    for(const email of ["demo-admin@example.test","demo-staff@example.test","demo-customer01@example.test","demo-customer12@example.test"])
      console.log(`  ${email} / ${DEMO_PASSWORD}`);
    console.log("  (demo-customer12@example.test intentionally LOCKED)");
    console.log("\nSample voucher codes: DEMO10, DEMO30K, DEMOVIP15, DEMOFREESHIP");
    console.log("NOTE: MoMo transactions are synthetic; no payment was sent to MoMo.");
  } catch (error) {
    try { await db.rollback(); } catch { /* retain original error */ }
    throw error;
  } finally {
    await db.execute("SELECT RELEASE_LOCK(?)", [`seed:${DB_NAME}:${TAG}`]);
  }
} catch (error) {
  console.error("\nSEED FAILED (transaction rolled back):", error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}