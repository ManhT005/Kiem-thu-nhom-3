import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../config/config.js";
import { AppError } from "../utils/app-error.js";

const readToken = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

export const authenticate = (req, _res, next) => {
  const token = readToken(req);
  if (!token)
    return next(
      new AppError(401, "UNAUTHENTICATED", "Authentication is required"),
    );

  try {
    req.user = jwt.verify(token, SECRET_KEY);
    return next();
  } catch {
    return next(
      new AppError(401, "UNAUTHENTICATED", "Invalid or expired token"),
    );
  }
};

export const optionalAuthenticate = (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, SECRET_KEY);
  } catch {
    return next(
      new AppError(401, "UNAUTHENTICATED", "Invalid or expired token"),
    );
  }
  return next();
};
