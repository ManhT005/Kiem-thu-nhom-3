import { success } from "../utils/api-response.js";
import { dashboardSummary,dashboardTopProducts,dashboardRevenueChart } from "../services/dashboard.service.js";
import { paymentReconciliation } from "../services/payment-reconciliation.service.js";
const endpoint = (work,code) => async (req,res,next) => {
  try { return success(res,{code,message:code.toLowerCase().replaceAll("_"," "),data:await work(req.query)}); }
  catch(error) { return next(error); }
};
export const summary = endpoint(dashboardSummary,"DASHBOARD_SUMMARY_FETCHED");
export const topProducts = endpoint(dashboardTopProducts,"DASHBOARD_TOP_PRODUCTS_FETCHED");
export const revenueChart = endpoint(dashboardRevenueChart,"DASHBOARD_REVENUE_CHART_FETCHED");
export const reconciliation = endpoint(query=>paymentReconciliation(query),"PAYMENT_RECONCILIATION_FETCHED");
export const reconciliationSummary = endpoint(query=>paymentReconciliation(query,true),"PAYMENT_RECONCILIATION_SUMMARY_FETCHED");
