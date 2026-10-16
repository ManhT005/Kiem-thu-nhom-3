const {spawn,execFileSync}=require('node:child_process');
const {once}=require('node:events');
const {mkdirSync,openSync,closeSync,writeFileSync}=require('node:fs');
const path=require('node:path');
const newman=require('newman');
const {loadSuites,safeSummary,summaryHtml}=require('./api-suite-utils.cjs');
(async()=>{
  if(!/_test$/i.test(process.env.DB_NAME||'')||process.env.ORDER_CONCURRENCY_TEST!=='1'||process.env.NODE_ENV==='production')throw new Error('API regression requires ORDER_CONCURRENCY_TEST=1 and an isolated *_test database');
  const folder=path.join(__dirname,'postman'),suites=loadSuites(folder);
  mkdirSync('test-results',{recursive:true});
  const log=openSync('test-results/server.log','w'),runs=[];
  let fixture,pool,runner;
  const api=spawn(process.execPath,['backend/server.js'],{stdio:['ignore',log,log,'ipc'],env:{...process.env,PORT:'0'}});
  const exited=once(api,'exit');
  let abort;
  const crashed=new Promise((_,reject)=>{abort=reject;});crashed.catch(()=>{});
  api.once('exit',()=>{runner?.abort();abort(new Error('API exited during regression'));});
  try {
    const port=await Promise.race([crashed,new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('API startup timed out')),30000);
      api.once('message',message=>{clearTimeout(timer);message.type==='ready'?resolve(message.port):reject(new Error('Unexpected readiness message'));});
      api.once('exit',()=>clearTimeout(timer));api.once('error',error=>{clearTimeout(timer);reject(error);});
    })]);
    const baseUrl=`http://127.0.0.1:${port}`;
    if(!(await fetch(baseUrl+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)throw new Error('API health check failed');
    for(const suite of suites) {
      if(suite.fixture==='reporting') {
        const {default:db}=await import('../backend/config/db.js');pool=db.promise();
        const {reportingFixture}=await import('../backend/tests/integration/reporting-fixture.js');fixture=await reportingFixture(pool);
      }
      const summary=await Promise.race([crashed,new Promise((resolve,reject)=>{
        runner=newman.run({collection:path.join(folder,suite.collection),environment:path.join(folder,'local.postman_environment.json'),
          envVar:[{key:'baseUrl',value:baseUrl}],reporters:['cli'],timeout:120000,timeoutRequest:15000,timeoutScript:5000},(error,value)=>error?reject(error):resolve(value));
      })]);
      runner=undefined;
      const safe=safeSummary(suite.name,summary);runs.push(safe);
      writeFileSync(`test-results/newman-${suite.name}.json`,JSON.stringify(safe,null,2));
      writeFileSync(`test-results/newman-${suite.name}.html`,summaryHtml(safe));
      if(safe.failures||!summary.run.stats.requests.total||summary.run.stats.requests.failed||summary.run.stats.assertions.failed||!summary.run.stats.assertions.total)throw new Error('Critical suite failed or had no assertions: '+suite.name);
    }
  } finally {
    runner?.abort();
    if(api.exitCode===null&&api.signalCode===null)api.kill('SIGTERM');
    const timer=setTimeout(()=>api.kill('SIGKILL'),10000);
    try { await exited; } finally {
      clearTimeout(timer);closeSync(log);
      try { if(fixture)await fixture.cleanup(); } finally { if(pool)await pool.end(); }
      writeFileSync('test-results/api-summary.json',JSON.stringify({sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
        generatedAt:new Date().toISOString(),node:process.version,database:process.env.DB_NAME,plannedSuites:suites.map(s=>s.name),
        completedSuites:runs.map(s=>s.name),passed:runs.length===suites.length&&runs.every(s=>s.failures===0),runs},null,2));
    }
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
