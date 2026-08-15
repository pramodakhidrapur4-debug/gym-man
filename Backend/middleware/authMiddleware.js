import jwt from "jsonwebtoken";
import Admin from "../Modules/Admin.js";

// Helper to parse cookies from req.headers.cookie
const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join("="));
    }
  });
  return cookies;
};

// Reusable authenticateOwner middleware
export const authenticateOwner = async (req, res, next) => {
  try {
    let token;

    // 1. Extract token from HTTP-only cookie
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.gym_owner_session || cookies.token) {
      token = cookies.gym_owner_session || cookies.token;
    }

    // 2. Fallback to Authorization: Bearer <token> header if present
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Session token missing or expired.",
      });
    }

    // 3. Verify JWT with 15-day server-side expiration enforcement
    const decoded = jwt.verify(
      token,
      process.env.JWT_SEC || process.env.JWT_SECRET || "default_jwt_secret"
    );

    // 4. Verify Role
    if (decoded.role !== "owner") {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Owner role required.",
      });
    }

    const ownerId = decoded.sub || decoded.id;
    const admin = await Admin.findById(ownerId).select("-passwordHash");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Owner account not found.",
      });
    }

    req.admin = admin;
    req.owner = admin;
    next();
  } catch (error) {
    // Return clean generic 401 response without exposing internal error stack/details
    return res.status(401).json({
      success: false,
      message: "Not authorized. Session token invalid or expired.",
    });
  }
};

// Alias for backwards compatibility
export const protectAdmin = authenticateOwner;
