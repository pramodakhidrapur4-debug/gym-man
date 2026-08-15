import express from "express";
import {
  loginAdmin,
  getMe,
  logoutAdmin,
  changePassword,
} from "../Controller/AdminController.js";
import { authenticateOwner } from "../middleware/authMiddleware.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Apply rate limiting to login endpoint to prevent brute-force attacks
router.post("/login", loginRateLimiter, loginAdmin);
router.get("/me", authenticateOwner, getMe);
router.post("/logout", logoutAdmin);
router.put("/change-password", authenticateOwner, changePassword);

export default router;
