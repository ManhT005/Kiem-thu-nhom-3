import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../config/config.js";
import { AppError } from "../utils/app-error.js";
import { userLifecycleRepository } from "../repositories/user-lifecycle.repository.js";

export function createAuthenticate({ optional = false, loadUser = (id) => userLifecycleRepository.findCurrentUser(id) } = {}) {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) return optional && !header ? next() : next(new AppError(401, "UNAUTHENTICATED", "Authentication is required"));
    let claims;
    try {
      claims = jwt.verify(token, SECRET_KEY, { algorithms: ["HS256"] });
      if (!Number.isSafeInteger(claims.id) || claims.id < 1 ||
          !Number.isSafeInteger(claims.token_version) || claims.token_version < 0) {
        return next(new AppError(401, "TOKEN_REVOKED", "Login again to refresh your token"));
      }
    } catch { return next(new AppError(401, "UNAUTHENTICATED", "Invalid or expired token")); }
    try {
      const user = await loadUser(claims.id);
      if (!user) return next(new AppError(401, "TOKEN_REVOKED", "User no longer exists"));
      if (user.status !== "ACTIVE") return next(new AppError(403, "ACCOUNT_LOCKED", "Account is locked"));
      if (user.token_version !== claims.token_version) return next(new AppError(401, "TOKEN_REVOKED", "Login again to refresh your token"));
      req.user = user; // persisted role, never the advisory JWT role
      return next();
    } catch (error) { return next(error); }
  };
}
export const authenticate = createAuthenticate();
export const optionalAuthenticate = createAuthenticate({ optional: true });
