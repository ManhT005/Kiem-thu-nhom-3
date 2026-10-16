import "dotenv/config";
import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import jwt from "jsonwebtoken";
import db from "../../config/db.js";
import app from "../../app.js";
import {SECRET_KEY} from "../../config/config.js";
import {integrationEnabled} from "./fixture-helper.js";
import {reportingFixture,reportingPeriod} from "./reporting-fixture.js";
import {dashboardSummary,dashboardTopProducts,dashboardRevenueChart} from "../../services/dashboard.service.js";
import {withReportingSnapshot} from "../../repositories/dashboard.repository.js";
import {paymentReconciliation} from "../../services/payment-reconciliation.service.js";
import {saveVoucher} from "../../services/voucher.service.js";
import {randomUUID} from "node:crypto";
const pool=db.promise();let f,server,base;
before(async()=>{if(!integrationEnabled)return;f=await reportingFixture(pool);server=app.listen(0);await once(server,"listening");base="http://127.0.0.1:"+server.address().port;});
after(async()=>{if(server)await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});if(f)await f.cleanup();await pool.end();});
const integration=(name,work)=>test(name,{skip:!integrationEnabled},work);
const token=role=>jwt.sign({id:f.users[role],role,token_version:0},SECRET_KEY);
async function api(path,role="admin",query=reportingPeriod){const response=await fetch(base+"/api/admin/"+path+"?"+new URLSearchParams(query),{headers:role?{Authorization:"Bearer "+token(role)}:{}});return{status:response.status,body:await response.json()};}

integration("P5-R-001/002/003/004/005/010 MySQL oracle: deduped completion, voucher snapshots, creation vs completion and legacy",async()=>{
  const result=await dashboardSummary(reportingPeriod);
  assert.equal(result.completedOrderCount,2);assert.equal(result.completedOrderValue,7000);
  assert.equal(result.grossCompletedValue,7500);assert.equal(result.completedDiscountAmount,500);
  assert.equal(result.grossCompletedValue-result.completedDiscountAmount,result.completedOrderValue);
  assert.equal(result.totalOrders,10);assert.ok(result.legacyExcluded>=2);
  // Independent oracle: fixture IDs, no reporting repository SQL reused.
  const [[oracle]]=await pool.execute("SELECT SUM(tongTien) AS total FROM DonHang WHERE maDonHang IN (?,?)",[f.ids.a,f.ids.b]);
  assert.equal(result.completedOrderValue,Number(oracle.total));
  const chart=await dashboardRevenueChart(reportingPeriod);
  assert.deepEqual(chart.buckets.map(row=>row.completedOrderValue),[4500,2500,0,0]);
  assert.equal(chart.buckets.reduce((sum,row)=>sum+row.completedOrderValue,0),result.completedOrderValue);
});
integration("P5-R-006/007 MySQL top products collapse sizes, tie-break by ID and day/week/month zero buckets",async()=>{
  const top=await dashboardTopProducts({...reportingPeriod,limit:"1"});
  assert.equal(top.items.length,1);assert.equal(top.items[0].productId,f.productId);assert.equal(top.items[0].quantity,2);assert.equal(top.items[0].grossSales,5000);
  assert.equal((await dashboardTopProducts({...reportingPeriod,sort:"grossSales"})).items.length,2);
  for(const groupBy of ["week","month"])assert.equal((await dashboardRevenueChart({...reportingPeriod,groupBy})).buckets.reduce((sum,row)=>sum+row.completedOrderValue,0),7000);
  const empty=await dashboardRevenueChart({from:"2024-02-28",to:"2024-03-02"});
  assert.equal(empty.buckets.length,3);assert.ok(empty.buckets.every(row=>row.completedOrderValue===0));
});
integration("P5-R-008/009 all five reporting routes enforce persisted RBAC and reject hostile filters",async()=>{
  for(const path of ["dashboard/summary","dashboard/top-products","dashboard/revenue-chart","payments/reconciliation","payments/reconciliation/summary"]){
    for(const role of [null,"user","staff","admin"]){const result=await api(path,role);assert.equal(result.status,role===null?401:role==="admin"?200:403,path+" "+role);assert.equal(typeof result.body.code,"string");}
  }
  for(const query of [{from:"2023-02-29",to:"2023-03-01"},{from:"2091-01-05",to:"2091-01-01"},{...reportingPeriod,from:["2091-01-01"]}].slice(0,2))assert.equal((await api("dashboard/summary","admin",query)).body.code,"INVALID_REPORT_FILTER");
  assert.equal((await api("dashboard/top-products","admin",{...reportingPeriod,sort:"quantity; DROP TABLE users"})).status,400);
  assert.equal((await api("dashboard/revenue-chart","admin",{...reportingPeriod,groupBy:"month OR 1=1"})).status,400);
  await pool.execute("UPDATE users SET status='LOCKED' WHERE id=?",[f.users.admin]);
  try{assert.equal((await api("dashboard/summary")).body.code,"ACCOUNT_LOCKED");}finally{await pool.execute("UPDATE users SET status='ACTIVE',token_version=1 WHERE id=?",[f.users.admin]);}
  assert.equal((await api("dashboard/summary")).body.code,"TOKEN_REVOKED");
  await pool.execute("UPDATE users SET token_version=0 WHERE id=?",[f.users.admin]);
});
integration("P5-R-011 MySQL repeatable read snapshot remains consistent across concurrent writer and pool isolation resets",async()=>{
  try{await withReportingSnapshot(async connection=>{
    const [[first]]=await connection.execute("SELECT tongTien FROM DonHang WHERE maDonHang=?",[f.ids.a]);
    await pool.execute("UPDATE DonHang SET tongTien=9999 WHERE maDonHang=?",[f.ids.a]);
    const [[second]]=await connection.execute("SELECT tongTien FROM DonHang WHERE maDonHang=?",[f.ids.a]);
    assert.equal(Number(first.tongTien),4500);assert.equal(Number(second.tongTien),4500);
    await assert.rejects(connection.execute("UPDATE DonHang SET tongTien=1 WHERE maDonHang=?",[f.ids.a]),{code:"ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION"});
  });}finally{await pool.execute("UPDATE DonHang SET tongTien=4500 WHERE maDonHang=?",[f.ids.a]);}
  const [[isolation]]=await pool.query("SELECT @@transaction_isolation AS value");assert.equal(isolation.value,"READ-COMMITTED");
});
integration("P5-P-009 reconciliation lists refund and real mismatches, excludes historical failed attempts and redacts private fields",async()=>{
  const clean=await paymentReconciliation(reportingPeriod);
  assert.equal(clean.total,1);assert.deepEqual(clean.items[0].reasons,["REFUND_REQUIRED"]);
  await f.attempt(f.ids.b,"FAILED");assert.equal((await paymentReconciliation(reportingPeriod)).total,1);
  await f.attempt(f.ids.pending,"PAID",1);
  const bad=await paymentReconciliation({...reportingPeriod,status:"PAYMENT_MISMATCH",limit:"1"});
  assert.equal(bad.total,1);assert.deepEqual(bad.items[0].reasons,["PAYMENT_MISMATCH","AMOUNT_MISMATCH"]);
  assert.equal(bad.items[0].orderId,f.ids.pending);
  assert.ok(!/email|signature|pay_url|request_id|matKhau|token/i.test(JSON.stringify(bad)));
  assert.equal((await paymentReconciliation({...reportingPeriod,page:"2",limit:"1"})).items.length,1);
  const summary=await paymentReconciliation(reportingPeriod,true);assert.equal(summary.total,2);assert.equal(summary.REFUND_REQUIRED,1);assert.equal(summary.AMOUNT_MISMATCH,1);
});
integration("P5-P-009 redemption states and multiple paid attempts flag real exceptions while refund reservations remain valid",async()=>{
  const voucher=await saveVoucher({code:"REC-"+randomUUID(),discountType:"FIXED",discountValue:500,minimumOrderAmount:0,
    startAt:new Date(Date.now()-60000).toISOString(),endAt:new Date(Date.now()+3600000).toISOString(),usageLimit:10,perUserLimit:10,enabled:true},f.users.admin);
  try {
    for(const[name,status]of [["a","COMMITTED"],["expired","RELEASED"],["refund","COMMITTED"],["confirmed","RESERVED"]]) {
      await pool.execute("UPDATE DonHang SET maGiamGia=? WHERE maDonHang=?",[voucher.maGiamGia,f.ids[name]]);
      await pool.execute("INSERT INTO VoucherRedemption(voucher_id,order_id,user_id,discount_amount,status) VALUES (?,?,?,500,?)",[voucher.maGiamGia,f.ids[name],f.users.user,status]);
    }
    let result=await paymentReconciliation({...reportingPeriod,status:"VOUCHER_MISMATCH"});
    assert.deepEqual(result.items.map(row=>row.orderId),[f.ids.confirmed]);
    await pool.execute("UPDATE VoucherRedemption SET status='COMMITTED' WHERE order_id=?",[f.ids.confirmed]);
    assert.equal((await paymentReconciliation({...reportingPeriod,status:"VOUCHER_MISMATCH"})).total,0);
    await f.attempt(f.ids.b,"PAID");
    assert.equal((await paymentReconciliation({...reportingPeriod,status:"MULTIPLE_PAID"})).items[0].orderId,f.ids.b);
    await pool.execute("DELETE FROM MomoPaymentTransaction WHERE maDonHang=?",[f.ids.confirmed]);
    result=await paymentReconciliation({...reportingPeriod,status:"PAYMENT_MISMATCH"});
    assert.ok(result.items.some(row=>row.orderId===f.ids.confirmed));
  } finally {
    await pool.execute("DELETE FROM VoucherRedemption WHERE voucher_id=?",[voucher.maGiamGia]);
    await pool.execute("UPDATE DonHang SET maGiamGia=NULL WHERE maGiamGia=?",[voucher.maGiamGia]);
    await pool.execute("DELETE FROM VoucherAudit WHERE voucher_id=?",[voucher.maGiamGia]);
    await pool.execute("DELETE FROM GiamGia WHERE maGiamGia=?",[voucher.maGiamGia]);
  }
});
integration("P5-R-001 MySQL amounts above MAX_SAFE_INTEGER serialize as exact decimal strings",async()=>{
  try {
    await pool.execute("UPDATE DonHang SET tongTien=9007199254740993,subtotal_before_discount=9007199254741493 WHERE maDonHang=?",[f.ids.a]);
    const result=await dashboardSummary(reportingPeriod);
    assert.equal(result.completedOrderValue,"9007199254743493");assert.equal(result.grossCompletedValue,"9007199254743993");
    assert.equal(BigInt(result.grossCompletedValue)-BigInt(result.completedDiscountAmount),BigInt(result.completedOrderValue));
  } finally { await pool.execute("UPDATE DonHang SET tongTien=4500,subtotal_before_discount=5000 WHERE maDonHang=?",[f.ids.a]); }
});
