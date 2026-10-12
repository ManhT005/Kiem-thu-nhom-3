function junitTotals(xml) {
  // Node's reporter emits flat testcases; Playwright wraps them in testsuites.
  // Count actual case/result tags instead of assuming testsuite summary attributes.
  if(!/<testsuites?\b/.test(xml))throw new Error("Invalid JUnit evidence");
  return {tests:(xml.match(/<testcase\b/g)||[]).length,failures:(xml.match(/<failure\b/g)||[]).length,
    errors:(xml.match(/<error\b/g)||[]).length,skipped:(xml.match(/<skipped\b/g)||[]).length};
}
module.exports={junitTotals};
