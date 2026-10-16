import { reportFilters, reportPeriod, exactInteger } from "../domain/reporting.js";
import { dashboardRepository, withReportingSnapshot } from "../repositories/dashboard.repository.js";

const metadata = filter => ({ period: reportPeriod(filter), currency: "VND", generatedAt: new Date().toISOString() });
export async function dashboardSummary(query, { snapshot = withReportingSnapshot, repository = dashboardRepository } = {}) {
  const filter = reportFilters(query);
  return snapshot(async connection => {
    const data = await repository.summary(connection, filter);
    const ordersByStatus = data.ordersByStatus.map(row => ({ ...row, count: exactInteger(row.count) }));
    return { ...metadata(filter), ...Object.fromEntries(Object.entries(data).filter(([key]) => key !== "ordersByStatus").map(([key,value]) => [key,exactInteger(value)])),
      ordersByStatus, totalOrders: exactInteger(ordersByStatus.reduce((sum,row) => sum + BigInt(row.count), 0n)),
      ordersByStatusBasis: "createdAt", currentCountsBasis: "allTimeSnapshot",
      warnings: Number(data.legacyExcluded) > 0 ? ["LEGACY_COMPLETION_HISTORY_MISSING"] : [] };
  });
}
export async function dashboardTopProducts(query, { snapshot = withReportingSnapshot, repository = dashboardRepository } = {}) {
  const filter = reportFilters(query, "top");
  return snapshot(async connection => ({ ...metadata(filter), sort: filter.sort, limit: filter.limit,
    salesBasis: "itemGrossBeforeVoucher", items: (await repository.topProducts(connection, filter)).map(row => ({ ...row, quantity: exactInteger(row.quantity), grossSales: exactInteger(row.grossSales) })) }));
}
export async function dashboardRevenueChart(query, { snapshot = withReportingSnapshot, repository = dashboardRepository } = {}) {
  const filter = reportFilters(query, "chart");
  return snapshot(async connection => {
    const rows = await repository.chart(connection, filter);
    const lookup = new Map(rows.map(row => [row.bucket.slice(0,10), row]));
    return { ...metadata(filter), groupBy: filter.groupBy, buckets: filter.buckets.map(start => {
      const row = lookup.get(start.slice(0,10));
      return { start, completedOrderCount: exactInteger(row?.completedOrderCount), completedOrderValue: exactInteger(row?.completedOrderValue) };
    }) };
  });
}
