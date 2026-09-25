import "dotenv/config";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("CONFIG_ERROR: JWT_SECRET is required");
}

export const SECRET_KEY = jwtSecret;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
