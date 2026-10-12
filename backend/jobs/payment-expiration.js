import { expirePendingMomoPayments } from "../services/payment.service.js";

// The caller owns this worker. Importing this module never starts it.
export function startPaymentExpiration({
  expire = expirePendingMomoPayments,
  intervalMs = 30_000,
  enabled = process.env.NODE_ENV !== "test",
  logger = console,
} = {}) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1) {
    throw new RangeError("Expiration interval must be a positive integer");
  }
  let stopped = !enabled;
  let inFlight;
  let lastErrorCode;
  const run = () => {
    if (stopped || inFlight) return inFlight ?? Promise.resolve();
    inFlight = Promise.resolve().then(expire).then(() => {
      lastErrorCode = undefined;
    }).catch((error) => {
      const code = error.code || error.name || "UNKNOWN";
      if (code !== lastErrorCode) logger.error(`MoMo expiration failed: ${code}`);
      lastErrorCode = code;
    }).finally(() => { inFlight = undefined; });
    return inFlight;
  };
  const timer = enabled ? setInterval(run, intervalMs) : undefined;
  timer?.unref();
  if (enabled) void run();
  return {
    run,
    async stop() {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    },
  };
}
