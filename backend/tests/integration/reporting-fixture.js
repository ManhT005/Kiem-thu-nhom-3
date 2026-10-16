import { randomUUID } from "node:crypto";
import { fixture } from "./fixture-helper.js";

export const reportingPeriod = {from:"2091-01-01",to:"2091-01-05"};
export async function reportingFixture(pool) {
  const f=await fixture(pool);
  const [product]=await pool.execute("INSERT INTO SanPham(tenSP,gia) VALUES (?,1250)",["Reporting B "+randomUUID()]);
  f.products=[f.productId,product.insertId];
  const [[momo]]=await pool.execute("SELECT maPTTT FROM phuongThucThanhToan WHERE tenPTTT='MOMO' LIMIT 1");
  const [[cod]]=await pool.execute("SELECT maPTTT FROM phuongThucThanhToan WHERE tenPTTT='COD' LIMIT 1");
  const ids={};
  async function order(name,status,total,completedAt,{payment="NOT_REQUIRED",method=cod.maPTTT,gross=total,discount=0,placed="2091-01-02",normalized=false}={}) {
    const [result]=await pool.execute(`INSERT INTO DonHang(id,maPTTT,trangThai,tongTien,subtotal_before_discount,discount_amount,ngayDat,payment_status)
      VALUES (?,?,?,?,?,?,?,?)`,[f.users.user,method,status,total,gross,discount,placed,payment]);
    ids[name]=result.insertId;
    if(completedAt)await pool.execute("INSERT INTO LichSuDonHang(maDonHang,trangThaiMoi,thoiGian,lyDo) VALUES (?,'Hoàn thành',?,?)",[result.insertId,completedAt,normalized?"LEGACY_STATUS_NORMALIZED":null]);
    return result.insertId;
  }
  await order("a","Hoàn thành",4500,"2091-01-01",{gross:5000,discount:500,placed:"2090-12-01"});
  await order("b","Hoàn thành",2500,"2091-01-02",{method:momo.maPTTT,payment:"PAID"});
  await pool.execute("INSERT INTO LichSuDonHang(maDonHang,trangThaiMoi,thoiGian) VALUES (?,'Hoàn thành','2091-01-03')",[ids.a]);
  for(const index of [0,1])await pool.execute("INSERT INTO ChiTietDonHang(maDonHang,maSP,maSize,soLuongMua,giaMua) VALUES (?,?,?,1,2500)",[ids.a,f.productId,f.variant(index).maSize]);
  await pool.execute("INSERT INTO ChiTietDonHang(maDonHang,maSP,maSize,soLuongMua,giaMua) VALUES (?,?,?,2,1250)",[ids.b,product.insertId,f.variant().maSize]);
  await order("boundary","Hoàn thành",2500,"2091-01-05");
  await order("legacy","Hoàn thành",1000,null);
  await order("normalized","Hoàn thành",1000,"2091-01-02",{normalized:true});
  await order("confirmed","Đã xác nhận",2500,null,{method:momo.maPTTT,payment:"PAID"});
  await order("failed","Đã hủy",2500,null,{method:momo.maPTTT,payment:"FAILED"});
  await order("expired","Đã hủy",2500,null,{method:momo.maPTTT,payment:"EXPIRED"});
  await order("refund","Đã hủy",2500,null,{method:momo.maPTTT,payment:"REFUND_REQUIRED"});
  await order("pending","Chờ xác nhận",2500,null);
  await order("shipping","Đang giao",2500,null);
  async function attempt(orderId,status="PAID",amount=2500) {
    await pool.execute(`INSERT INTO MomoPaymentTransaction(maDonHang,provider_order_id,request_id,amount,status,expires_at)
      VALUES (?,?,?,?,?,'2091-01-10')`,[orderId,randomUUID(),randomUUID(),amount,status]);
  }
  for(const name of ["b","confirmed","refund"])await attempt(ids[name]);
  await attempt(ids.failed,"FAILED");await attempt(ids.expired,"EXPIRED");
  const originalCleanup=f.cleanup;
  f.cleanup=async()=>{await originalCleanup();await pool.execute("DELETE FROM SanPham WHERE maSP=?",[product.insertId]);};
  return {...f,ids,secondProductId:product.insertId,attempt};
}
