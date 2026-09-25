import {
  authenticate,
  optionalAuthenticate,
} from "./authenticate.middleware.js";
import { authorizeRoles } from "./authorize.middleware.js";

export const verifyToken = authenticate;
export const verifyOptionalToken = optionalAuthenticate;
export const verifyAdmin = authorizeRoles("admin");
