const {readFileSync,existsSync} = require("node:fs");
const path = require("node:path");
function loadSuites(folder) {
  const suites=JSON.parse(readFileSync(path.join(folder,"suites.json"),"utf8"));
  if(!Array.isArray(suites)||suites.length===0)throw new Error("Suite manifest must not be empty");
  const names=new Set();
  for(const suite of suites) {
    if(!/^[A-Za-z0-9-]+$/.test(suite.name)||names.has(suite.name))throw new Error("Invalid or duplicate suite name");
    names.add(suite.name);
    if(!/^[A-Za-z0-9-]+\.postman_collection\.json$/.test(suite.collection)||!existsSync(path.join(folder,suite.collection)))throw new Error("Missing or unsafe suite collection: "+suite.name);
    if(suite.severity!=="critical"||![undefined,"reporting"].includes(suite.fixture))throw new Error("Invalid suite severity or fixture");
    JSON.parse(readFileSync(path.join(folder,suite.collection),"utf8"));
  }
  return suites;
}
function safeSummary(name,summary) {
  // Explicit fields only: no headers, bodies, cookies, environments or assertion actual/expected.
  return {name,stats:summary.run.stats,failures:summary.run.failures.length,
    executions:summary.run.executions.map(entry=>({name:entry.item.name,status:entry.response?.code??null,
      durationMs:entry.response?.responseTime??null,assertions:(entry.assertions??[]).map(value=>({name:value.assertion,passed:!value.error}))}))};
}
const escape=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
function summaryHtml(summary) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(summary.name)} regression</title><h1>${escape(summary.name)}</h1><p>Failures: ${summary.failures}. Request/response bodies and authentication data omitted.</p><table><thead><tr><th>Scenario</th><th>HTTP</th><th>ms</th><th>Assertions</th></tr></thead><tbody>${summary.executions.map(row=>`<tr><td>${escape(row.name)}</td><td>${escape(row.status)}</td><td>${escape(row.durationMs)}</td><td>${row.assertions.map(value=>escape(value.name)+": "+(value.passed?"PASS":"FAIL")).join("<br>")}</td></tr>`).join("")}</tbody></table></html>`;
}
module.exports={loadSuites,safeSummary,summaryHtml};
