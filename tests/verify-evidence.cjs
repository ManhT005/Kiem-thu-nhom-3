const {readFileSync,writeFileSync}=require("node:fs");
const {execFileSync}=require("node:child_process");
const {createHash}=require("node:crypto");
const {loadSuites}=require("./api-suite-utils.cjs");
const {junitTotals}=require("./evidence-utils.cjs");
async function main() {
  const suites=loadSuites("tests/postman"),requests=[];
  for(const suite of suites) {
    function visit(items){for(const item of items){if(item.item)visit(item.item);else{
      const raw=typeof item.request.url==="string"?item.request.url:item.request.url.raw;
      requests.push({suite:suite.name,name:item.name,method:item.request.method,path:raw.replace("{{baseUrl}}","").split("?")[0]});
    }}}
    visit(JSON.parse(readFileSync("tests/postman/"+suite.collection,"utf8")).item);
  }
  const {endpointInventory}=await import("../backend/scripts/api-endpoint-inventory.js");
  const {default:db}=await import("../backend/config/db.js");
  try {
    const inventory=endpointInventory().map(endpoint=>{
      const pattern=new RegExp("^"+endpoint.path.split("/").map(part=>part.startsWith(":")?"[^/]+":part.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("/")+"$");
      return {...endpoint,tests:requests.filter(request=>request.method===endpoint.method&&pattern.test(request.path)).map(request=>request.suite+": "+request.name)};
    });
    writeFileSync("test-results/endpoint-coverage.json",JSON.stringify(inventory,null,2));
    const uncovered=inventory.filter(endpoint=>!endpoint.tests.length);
    if(uncovered.length)throw new Error("Missing API endpoint cases: "+uncovered.map(e=>e.method+" "+e.path).join(", "));
    const layers={};
    for(const layer of ["unit","integration","browser"]) {
      const xml=readFileSync(`test-results/${layer}.xml`,"utf8");
      const totals=junitTotals(xml);
      if(!totals.tests||totals.failures||totals.errors||totals.skipped)throw new Error("Missing, failed or skipped critical evidence: "+layer);
      layers[layer]=totals;
    }
    const api=JSON.parse(readFileSync("test-results/api-summary.json","utf8"));
    if(!api.passed||JSON.stringify(api.completedSuites)!==JSON.stringify(suites.map(s=>s.name)))throw new Error("Incomplete API regression evidence");
    const durations=api.runs.flatMap(run=>run.executions.map(e=>e.durationMs)).filter(Number.isFinite).sort((a,b)=>a-b);
    const [[engine]]=await db.promise().query("SELECT VERSION() AS version");
    const [migrations]=await db.promise().query("SELECT name,checksum,state FROM schema_migrations ORDER BY name");
    if(migrations.length!==6||migrations.some(m=>m.state!=="APPLIED"))throw new Error("Migration baseline is incomplete");
    const metadata={sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),generatedAt:new Date().toISOString(),node:process.version,mysql:engine.version,
      database:process.env.DB_NAME,layers,apiRequests:api.runs.reduce((sum,run)=>sum+run.stats.requests.total,0),apiAssertions:api.runs.reduce((sum,run)=>sum+run.stats.assertions.total,0),
      endpointCoverage:{covered:inventory.length,total:inventory.length},responseTimeMs:{p95:durations[Math.ceil(durations.length*.95)-1],maximum:durations.at(-1),scope:"observed local/CI API smoke; no production SLO"},
      migrations,suiteChecksums:suites.map(s=>({name:s.name,sha256:createHash("sha256").update(readFileSync("tests/postman/"+s.collection)).digest("hex")})),externalMomo:"BLOCKED_EXTERNAL",humanAcceptance:"PENDING"};
    writeFileSync("test-results/release-evidence.json",JSON.stringify(metadata,null,2));
    console.log(JSON.stringify(metadata,null,2));
  } finally { await db.promise().end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
