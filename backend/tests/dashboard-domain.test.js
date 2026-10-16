import test from "node:test";
import assert from "node:assert/strict";
import { reportFilters,parseReportDate,exactInteger } from "../domain/reporting.js";
import { dashboardRevenueChart,dashboardSummary } from "../services/dashboard.service.js";
import { withReportingSnapshot } from "../repositories/dashboard.repository.js";

test("P5-R-005/008 strict UTC dates, calendar boundaries, range and injection validation",()=>{
  assert.equal(parseReportDate("2024-02-29").toISOString(),"2024-02-29T00:00:00.000Z");
  assert.equal(parseReportDate("2026-10-01T07:00:00+07:00").toISOString(),"2026-10-01T00:00:00.000Z");
  for(const value of ["2023-02-29","2024-02-30","2026-13-01","2026-10-01T00:00:00","2026-10-01T24:00:00Z","not-a-date",[],"2026-10-01' OR 1=1"])
    assert.throws(()=>parseReportDate(value),{code:"INVALID_REPORT_FILTER"});
  for(const query of [{from:"2026-01-01"},{from:"2026-02-01",to:"2026-01-01"},{from:"2020-01-01",to:"2026-01-01"},{timezone:"local"}])
    assert.throws(()=>reportFilters(query),{code:"INVALID_REPORT_FILTER"});
});
test("P5-R-006 chart zero buckets cover Monday weeks, year/month transitions and leap day",async()=>{
  const chart=await dashboardRevenueChart({from:"2024-02-28",to:"2024-03-02"},{snapshot:work=>work({}),repository:{chart:async()=>[
    {bucket:"2024-02-29",completedOrderCount:1,completedOrderValue:"9007199254740993"},
  ]}});
  assert.deepEqual(chart.buckets.map(b=>b.completedOrderValue),[0,"9007199254740993",0]);
  assert.deepEqual(reportFilters({from:"2025-12-31",to:"2026-01-06",groupBy:"week"},"chart").buckets,["2025-12-29T00:00:00.000Z","2026-01-05T00:00:00.000Z"]);
  assert.equal(reportFilters({from:"2025-12-31",to:"2026-02-01",groupBy:"month"},"chart").buckets.length,2);
  assert.throws(()=>reportFilters({from:"2026-01-01",to:"2026-02-01"},"chart"),{code:"INVALID_REPORT_FILTER"});
  assert.throws(()=>reportFilters({groupBy:"day; DROP TABLE DonHang"},"chart"),{code:"INVALID_REPORT_FILTER"});
});
test("P5-R-007 top limit BVA and stable sort whitelist",()=>{
  for(const limit of ["1","20"])assert.equal(reportFilters({limit},"top").limit,Number(limit));
  for(const limit of ["0","21","1 OR 1=1",["1"],"1.0"])assert.throws(()=>reportFilters({limit},"top"),{code:"INVALID_REPORT_FILTER"});
  assert.throws(()=>reportFilters({sort:"grossSales DESC"},"top"),{code:"INVALID_REPORT_FILTER"});
  assert.throws(()=>reportFilters({page:"10001"},"reconciliation"),{code:"INVALID_REPORT_FILTER"});
});
test("whole VND and counts preserve integers beyond IEEE-754",async()=>{
  assert.equal(exactInteger("9007199254740991.00"),Number.MAX_SAFE_INTEGER);
  assert.equal(exactInteger("9007199254740992"),"9007199254740992");
  assert.throws(()=>exactInteger("1.25"),{code:"INVALID_REPORT_DATA"});
  const value=await dashboardSummary({}, {snapshot:work=>work({}),repository:{summary:async()=>({completedOrderValue:"9007199254740993",legacyExcluded:1,ordersByStatus:[{status:"Hoàn thành",count:2}]})}});
  assert.equal(value.completedOrderValue,"9007199254740993");assert.equal(value.totalOrders,2);assert.equal(value.warnings.length,1);
});
test("P5-R-011 snapshot commits or rolls back and always releases the pooled connection",async()=>{
  for(const fails of [false,true]) {
    const calls=[],connection={query:async sql=>calls.push(sql),commit:async()=>calls.push("commit"),rollback:async()=>calls.push("rollback"),release:()=>calls.push("release")};
    const pool={promise:()=>({getConnection:async()=>connection})};
    const work=()=>{if(fails)throw new Error("query failure");return 42;};
    if(fails)await assert.rejects(withReportingSnapshot(work,pool),/query failure/);else assert.equal(await withReportingSnapshot(work,pool),42);
    assert.deepEqual(calls,["SET TRANSACTION ISOLATION LEVEL REPEATABLE READ","START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY",fails?"rollback":"commit","release"]);
  }
});
