import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
const {loadSuites,safeSummary,summaryHtml}=createRequire(import.meta.url)("../../tests/api-suite-utils.cjs");
const {junitTotals}=createRequire(import.meta.url)("../../tests/evidence-utils.cjs");
test("P6-05 evidence accepts flat and wrapped JUnit and detects failed/skipped cases",()=>{
  assert.deepEqual(junitTotals('<testsuites><testcase name="flat"/></testsuites>'),{tests:1,failures:0,errors:0,skipped:0});
  assert.deepEqual(junitTotals('<testsuites><testsuite><testcase><failure/></testcase><testcase><skipped/></testcase></testsuite></testsuites>'),{tests:2,failures:1,errors:0,skipped:1});
});
test("P6-02 missing manifest collection fails instead of silently skipping a critical suite",()=>{
  const folder=mkdtempSync(path.join(tmpdir(),"ptda-manifest-"));
  try{writeFileSync(path.join(folder,"suites.json"),JSON.stringify([{name:"Missing",collection:"Missing.postman_collection.json",severity:"critical"}]));assert.throws(()=>loadSuites(folder),/Missing or unsafe/);}
  finally{rmSync(folder,{recursive:true,force:true});}
});
test("P6-02 published Newman artifacts omit tokens, private bodies and unsafe markup",()=>{
  const safe=safeSummary("Regression",{run:{stats:{},failures:[],executions:[{item:{name:"<script>alert(1)</script>"},response:{code:200,responseTime:1,body:'{"token":"secret"}'},request:{headers:{Authorization:"Bearer secret"}},assertions:[{assertion:"Envelope"}]}]}});
  assert.ok(!JSON.stringify(safe).includes("secret"));assert.ok(!summaryHtml(safe).includes("<script>"));
});
