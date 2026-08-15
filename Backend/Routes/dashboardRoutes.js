import express from "express";
import { getDashboardData } from "../Controller/DashboardController.js";
import { authenticateOwner } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateOwner);

router.get("/", getDashboardData);

export default router;
