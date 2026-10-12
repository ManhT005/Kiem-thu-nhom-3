const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  workers: 1,
  reporter: [["list"], ["junit", { outputFile: "test-results/browser.xml" }]],
  outputDir: "test-results/browser",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "node backend/server.js",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: false,
    env: { NODE_ENV: "test", JWT_SECRET: "browser-test-only-secret" },
  },
});
