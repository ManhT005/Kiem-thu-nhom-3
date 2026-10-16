import { reportFilters,reportPeriod,exactInteger } from "../domain/reporting.js";
import { withReportingSnapshot } from "../repositories/dashboard.repository.js";
import { reconciliationRepository,reconciliationReasons } from "../repositories/payment-reconciliation.repository.js";

export async function paymentReconciliation(query, summary = false, { snapshot = withReportingSnapshot, repository = reconciliationRepository } = {}) {
  const filter = reportFilters(query, summary ? "summary" : "reconciliation");
  return snapshot(async connection => {
    const metadata = { period: reportPeriod(filter), periodBasis: "orderCreatedAt", generatedAt: new Date().toISOString() };
    if (summary) return { ...metadata, groupsOverlap: true, ...Object.fromEntries(Object.entries(await repository.summary(connection,filter)).map(([key,value])=>[key,exactInteger(value)])) };
    const result = await repository.list(connection,filter);
    return { ...metadata, page: filter.page, limit: filter.limit, total: exactInteger(result.total), items: result.items.map(row => ({
      orderId: row.orderId, orderStatus: row.orderStatus, paymentStatus: row.paymentStatus, orderValue: exactInteger(row.orderValue),
      createdAt: row.createdAt, attemptCount: exactInteger(row.attemptCount), reasons: reconciliationReasons(row),
    })) };
  });
}
