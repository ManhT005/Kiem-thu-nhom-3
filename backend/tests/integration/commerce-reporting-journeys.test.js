import "dotenv/config";
import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHmac} from "node:crypto";
import {once} from "node:events";
import jwt from "jsonwebtoken";
import db from "../../config/db.js";
import app from "../../app.js";
import {SECRET_KEY} from "../../config/config.js";
import {fixture,integrationEnabled} from "./fixture-helper.js";
import {saveVoucher} from "../../services/voucher.service.js";
import {createMomoPaymentForOrder,expirePendingMomoPayments} from "../../services/payment.service.js";
import {buildMomoIpnSignatureString} from "../../services/momo.service.js";
const pool=db.promise();let server,base;
const oldCredentials={access:process.env.MOMO_ACCESS_KEY,secret:process.env.MOMO_SECRET_KEY};
before(async()=>{if(!integrationEnabled)return;process.env.MOMO_ACCESS_KEY="journey-test-access";process.env.MOMO_SECRET_KEY="journey-test-secret";server=app.listen(0);await once(server,"listening");base="http://127.0.0.1:"+server.address().port;});
after(async()=>{if(server)await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});await pool.end();for(const[key,value]of [["MOMO_ACCESS_KEY",oldCredentials.access],["MOMO_SECRET_KEY",oldCredentials.secret]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
const token=(f,role)=>jwt.sign({id:f.users[role],role,token_version:0},SECRET_KEY);
async function api(f,path,method="GET",role="admin",data) {
  const response=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(role?{Authorization:"Bearer "+token(f,role)}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  return {status:response.status,body:response.status===204?null:await response.json()};
}
async function summary(f){return (await api(f,"/api/admin/dashboard/summary")).body.data;}
const integration=(name,work)=>test(name,{skip:!integrationEnabled},async()=>{
  const f=await fixture(pool,20),vouchers=[];
  f.voucher=async()=>{const voucher=await saveVoucher({code:"J-"+randomUUID(),discountType:"FIXED",discountValue:500,minimumOrderAmount:0,startAt:new Date(Date.now()-60000).toISOString(),endAt:new Date(Date.now()+3600000).toISOString(),usageLimit:10,perUserLimit:10,enabled:true},f.users.admin);vouchers.push(voucher.maGiamGia);return voucher;};
  try{await work(f);}finally{
    await f.cleanup();for(const id of vouchers){await pool.execute("DELETE FROM VoucherAudit WHERE voucher_id=?",[id]);await pool.execute("DELETE FROM GiamGia WHERE maGiamGia=?",[id]);}
  }
});
integration("J1/J2/J4 COD checkout, forged totals, voucher, idempotency, completed dashboard and exactly-once cancellation ledger",async f=>{
  const before=await summary(f),voucher=await f.voucher();
  assert.equal((await api(f,"/api/cart/add","POST","user",{...f.variant(),soLuong:1})).status,200);
  const request=f.order({voucherCode:voucher.code,idempotencyKey:randomUUID(),tongTien:1});
  const retries=await Promise.all(Array.from({length:10},()=>api(f,"/api/orders/create","POST","user",request)));
  assert.ok(retries.every(value=>value.status===201));const order=retries[0].body.data;
  assert.equal(new Set(retries.map(value=>value.body.data.maDonHang)).size,1);assert.equal(order.tongTien,2000);assert.equal(await f.stock(),19);
  for(const trangThai of ["Đã xác nhận","Đang giao","Hoàn thành"])assert.equal((await api(f,`/api/orders/${order.maDonHang}/status`,"PUT","staff",{trangThai})).status,200);
  const after=await summary(f);assert.equal(after.completedOrderValue-before.completedOrderValue,2000);assert.equal(after.completedOrderCount-before.completedOrderCount,1);
  assert.equal((await api(f,`/api/orders/${order.maDonHang}/status`,"PUT","staff",{trangThai:"Hoàn thành"})).status,409);
  const pending=await api(f,"/api/orders/create","POST","user",f.order({voucherCode:voucher.code}));assert.equal(pending.status,201);
  const cancelled=await Promise.all(Array.from({length:10},()=>api(f,`/api/orders/${pending.body.data.maDonHang}/cancel`,"PUT","user",{})));
  assert.equal(cancelled.filter(value=>value.status===200).length,1);assert.equal(await f.stock(),19);
  const [[usage]]=await pool.execute("SELECT used_count FROM GiamGia WHERE maGiamGia=?",[voucher.maGiamGia]);assert.equal(usage.used_count,1);
  const [[ledger]]=await pool.execute("SELECT COUNT(*) AS count FROM InventoryMovement WHERE reference_id=? AND event_type='CANCEL'",[String(pending.body.data.maDonHang)]);assert.equal(ledger.count,1);
  assert.equal((await summary(f)).completedOrderValue,after.completedOrderValue);
});
integration("J3 receipt POST then sale preserves reconciliation; direct raw inventory mutation denied",async f=>{
  const receipt=await api(f,"/api/inventory/receipts","POST","staff",{items:[{...f.variant(),soLuongNhap:5,donGiaNhap:100}],idempotencyKey:randomUUID()});
  assert.equal(receipt.status,201);assert.equal(await f.stock(),20);
  assert.equal((await api(f,`/api/inventory/receipts/${receipt.body.data.maPhieuNhap}/post`,"POST","staff",{})).status,200);
  assert.equal(await f.stock(),25);assert.equal((await api(f,"/api/orders/create","POST","user",f.order())).status,201);assert.equal(await f.stock(),24);
  const reconciliation=await api(f,"/api/inventory/reconciliation?maSP="+f.productId+"&maSize="+f.variant().maSize);
  assert.ok(reconciliation.body.data.items.every(row=>row.difference===0));
  assert.ok((await api(f,"/api/kho/"+f.productId,"PUT","admin",{soLuongTon:999})).status>=400);
});
async function momo(f,voucher) {
  const [[method]]=await pool.execute("SELECT maPTTT FROM phuongThucThanhToan WHERE tenPTTT='MOMO' LIMIT 1");
  const created=await api(f,"/api/orders/create","POST","user",f.order({maPTTT:method.maPTTT,voucherCode:voucher?.code}));assert.equal(created.status,201);
  const order=created.body.data;
  await createMomoPaymentForOrder({orderId:order.maDonHang,userId:f.users.user},{makePaymentLink:async()=>({resultCode:0,payUrl:"https://test-payment.momo.vn/pay"})});
  const [[payment]]=await pool.execute("SELECT * FROM MomoPaymentTransaction WHERE maDonHang=?",[order.maDonHang]);
  return {order,payment};
}
function signed(payment,overrides={}) {
  const payload={partnerCode:"MOMO",amount:Number(payment.amount),orderId:payment.provider_order_id,requestId:payment.request_id,resultCode:0,
    transId:String(payment.id+90000000),extraData:"",message:"Test callback",orderInfo:"Test order",orderType:"momo_wallet",payType:"qr",responseTime:String(Date.now()),...overrides};
  payload.signature=createHmac("sha256",process.env.MOMO_SECRET_KEY).update(buildMomoIpnSignatureString(payload,process.env.MOMO_ACCESS_KEY)).digest("hex");return payload;
}
integration("J6/P5-P-001/002/003 signed HTTP IPN rejects tampering, replays ten times and completed report counts once",async f=>{
  const before=await summary(f),voucher=await f.voucher(),{order,payment}=await momo(f,voucher);
  for(const payload of [{...signed(payment),signature:"0".repeat(64)},signed(payment,{requestId:"wrong"}),signed(payment,{amount:1}),signed(payment,{partnerCode:"WRONG"})])assert.equal((await api(f,"/api/payments/momo/ipn","POST",null,payload)).status,400);
  const payload=signed(payment),callbacks=await Promise.all(Array.from({length:10},()=>api(f,"/api/payments/momo/ipn","POST",null,payload)));
  assert.ok(callbacks.every(value=>value.status===204));assert.equal((await summary(f)).completedOrderValue,before.completedOrderValue);
  const [[history]]=await pool.execute("SELECT COUNT(*) AS count FROM LichSuDonHang WHERE maDonHang=? AND trangThaiMoi='Đã xác nhận'",[order.maDonHang]);assert.equal(history.count,1);
  for(const trangThai of ["Đang giao","Hoàn thành"])assert.equal((await api(f,`/api/orders/${order.maDonHang}/status`,"PUT","staff",{trangThai})).status,200);
  assert.equal((await summary(f)).completedOrderValue-before.completedOrderValue,2000);assert.equal(await f.stock(),19);
  assert.equal((await api(f,"/api/payments/momo/ipn","POST",null,payload)).status,204);
  const report=await api(f,"/api/admin/payments/reconciliation");assert.ok(!report.body.data.items.some(value=>value.orderId===order.maDonHang));
});
integration("J7/P5-P-004/005/008 expiry then late signed callback exposes refund, voucher released and stock restored once",async f=>{
  const before=await summary(f),voucher=await f.voucher(),{order,payment}=await momo(f,voucher);
  await pool.execute("UPDATE DonHang SET payment_expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE maDonHang=?",[order.maDonHang]);
  await pool.execute("UPDATE MomoPaymentTransaction SET expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE id=?",[payment.id]);
  await Promise.all([expirePendingMomoPayments(),expirePendingMomoPayments()]);assert.equal(await f.stock(),20);
  const payload=signed(payment);assert.equal((await api(f,"/api/payments/momo/ipn","POST",null,payload)).status,204);assert.equal((await api(f,"/api/payments/momo/ipn","POST",null,payload)).status,204);
  assert.equal(await f.stock(),20);assert.equal((await summary(f)).completedOrderValue,before.completedOrderValue);
  const [[usage]]=await pool.execute("SELECT used_count FROM GiamGia WHERE maGiamGia=?",[voucher.maGiamGia]);assert.equal(usage.used_count,0);
  const report=await api(f,"/api/admin/payments/reconciliation?status=REFUND_REQUIRED");assert.ok(report.body.data.items.some(value=>value.orderId===order.maDonHang));
});
