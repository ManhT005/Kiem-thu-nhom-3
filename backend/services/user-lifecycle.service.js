import db from "../config/db.js";
import { withTransaction } from "../utils/transaction.js";
import { AppError } from "../utils/app-error.js";
import { integer, reason, listFilters, invalid } from "../domain/inventory.js";
import { userLifecycleRepository } from "../repositories/user-lifecycle.repository.js";

export async function changeUserLifecycle(input, { transaction = withTransaction, repository = userLifecycleRepository } = {}) {
  const userId = integer(input.userId, "user id"), note = reason(input.reason);
  if (!["LOCK","UNLOCK","ROLE"].includes(input.operation)) invalid("Unknown user operation");
  if (input.operation === "ROLE" && !["user","staff","admin"].includes(input.role)) invalid("Invalid role");
  return transaction(async (connection) => {
    const admins = await repository.lockAdmins(connection);
    const actor = await repository.lockUser(connection, input.actorId);
    if (!actor || actor.role !== "admin" || actor.status !== "ACTIVE") throw new AppError(403, "FORBIDDEN", "An active administrator is required");
    if (input.actorVersion !== undefined && actor.token_version !== input.actorVersion) throw new AppError(401, "TOKEN_REVOKED", "Login again");
    if (userId === Number(input.actorId)) throw new AppError(409, "SELF_MANAGEMENT_FORBIDDEN", "Administrators cannot lock or change their own role");
    const user = await repository.lockUser(connection, userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    const updated = { ...user, status: input.operation === "LOCK" ? "LOCKED" : input.operation === "UNLOCK" ? "ACTIVE" : user.status,
      role: input.operation === "ROLE" ? input.role : user.role };
    if (updated.status === user.status && updated.role === user.role) return { ...user, duplicate: true };
    if (user.role === "admin" && user.status === "ACTIVE" && (updated.role !== "admin" || updated.status !== "ACTIVE") && admins.length <= 1) {
      throw new AppError(409, "LAST_ACTIVE_ADMIN", "Keep at least one active administrator");
    }
    if (user.token_version >= 4294967295) throw new AppError(409, "TOKEN_VERSION_OVERFLOW", "Token version limit reached");
    updated.token_version++;
    if (await repository.update(connection, updated) !== 1) throw new AppError(409, "USER_CONFLICT", "Unable to update user");
    const snapshot = ({ role, status, token_version }) => ({ role, status, token_version });
    await repository.audit(connection, { actorId: input.actorId, userId, operation: input.operation, reason: note,
      before: snapshot(user), after: snapshot(updated) });
    return { ...updated, duplicate: false };
  });
}
export async function listUsers(query = {}) {
  const filters = listFilters(query), conditions = [], values = [];
  for (const [field, allowed] of [["status",["ACTIVE","LOCKED"]],["role",["user","staff","admin"]]]) {
    if (query[field] !== undefined) { if (!allowed.includes(query[field])) invalid("Invalid user filter"); conditions.push(`${field} = ?`); values.push(query[field]); }
  }
  if (query.search !== undefined) {
    if (typeof query.search !== "string" || query.search.length > 100) invalid("Invalid user search");
    conditions.push("(ten LIKE ? OR email LIKE ?)");
    const value = "%" + query.search.replace(/[\\%_]/g,"\\$&") + "%"; values.push(value,value);
  }
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const executor = db.promise();
  const [[count]] = await executor.execute("SELECT COUNT(*) AS total FROM users" + where, values);
  const [items] = await executor.execute(
    "SELECT id, ten, email, role, status FROM users" + where + ` ORDER BY id LIMIT ${filters.limit} OFFSET ${filters.offset}`, values);
  return { items, pagination: { page: filters.page, limit: filters.limit, total: Number(count.total), totalPages: Math.ceil(Number(count.total)/filters.limit) } };
}
