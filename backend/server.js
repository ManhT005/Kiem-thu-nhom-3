import "dotenv/config";
import { pathToFileURL } from "node:url";
import { once } from "node:events";
import app from "./app.js";
import db from "./config/db.js";
import { startPaymentExpiration } from "./jobs/payment-expiration.js";

export default app;

export async function startServer({ port = process.env.PORT || 3000 } = {}) {
  const server = app.listen(port);
  await once(server, "listening");
  const worker = startPaymentExpiration();
  let shutdownPromise;

  const shutdown = () => {
    if (shutdownPromise) return shutdownPromise;
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    shutdownPromise = (async () => {
      try {
        await Promise.all([
          worker.stop(),
          new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
            server.closeIdleConnections();
          }),
        ]);
        await db.promise().end();
      } finally {
        clearTimeout(deadline);
        process.off("SIGINT", onSignal);
        process.off("SIGTERM", onSignal);
      }
    })();
    return shutdownPromise;
  };
  const onSignal = () => shutdown().catch((error) => {
    console.error("Shutdown failed:", error.code || error.message);
    process.exit(1);
  });
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  return { server, shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().then(({ server }) => {
    console.log(`Server is running on port ${server.address().port}`);
    process.send?.({ type: "ready", port: server.address().port });
  }).catch((error) => {
    console.error("Server startup failed:", error.code || error.message);
    process.exitCode = 1;
  });
}
