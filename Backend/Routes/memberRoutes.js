import express from "express";
import {
  createMember,
  getAllMembers,
  getMemberById,
  updateMember,
  deleteMember,
} from "../Controller/MemberController.js";
import { protectAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All member routes protected by Owner JWT middleware
router.use(protectAdmin);

router.post("/", createMember);
router.get("/", getAllMembers);
router.get("/:id", getMemberById);
router.put("/:id", updateMember);
router.delete("/:id", deleteMember);

export default router;
