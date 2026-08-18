import Admin from "../Modules/Admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

// Gym ID Normalization Rule:
// 1. Remove leading/trailing whitespace
// 2. Convert to lowercase
const normalizeGymId = (rawId) => {
  if (typeof rawId !== "string") return "";
  return rawId.trim().toLowerCase();
};

// Generate 15-Day Server-Side Signed JWT Token
const generateToken = (ownerId, role) => {
  return jwt.sign(
    { sub: ownerId, role: role || "owner" },
    process.env.JWT_SEC || process.env.JWT_SECRET || "default_jwt_secret",
    { expiresIn: "15d" }
  );
};

// Set HTTP-Only Cookie Helper
const setAuthCookie = (res, token) => {
  res.cookie("gym_owner_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: FIFTEEN_DAYS_MS,
  });
};

// @desc    Login Admin / Owner
// @route   POST /api/auth/login (also POST /api/admin/login)
// @access  Public
export const loginAdmin = async (req, res) => {
  try {
    const rawId = req.body.gymId || req.body.id;
    const { password } = req.body;

    // Generic error message to prevent enumeration
    const GENERIC_AUTH_ERROR = "Invalid gym ID or password.";

    if (!rawId || !password) {
      return res.status(400).json({
        success: false,
        message: GENERIC_AUTH_ERROR,
      });
    }

    // 1. Normalize Gym ID: trim whitespace + convert to lowercase
    const normalizedId = normalizeGymId(rawId);

    // Look up owner with normalizedGymId index
    const admin = await Admin.findOne({ normalizedGymId: normalizedId }).select("+passwordHash");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: GENERIC_AUTH_ERROR,
      });
    }

    // 2. Compare password against stored passwordHash - STRICTLY CASE-SENSITIVE
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: GENERIC_AUTH_ERROR,
      });
    }

    // Update lastLoginAt timestamp
    admin.lastLoginAt = new Date();
    await admin.save();

    // 3. Generate 15-Day JWT Token
    const token = generateToken(admin._id, admin.role);

    // 4. Set HTTP-Only Cookie
    setAuthCookie(res, token);

    // 5. Return safe user information only (NO passwordHash, NO secrets)
    return res.status(200).json({
      success: true,
      message: "Welcome to POWER HOUSE MULTI GYM Owner Portal",
      token,
      user: {
        id: admin._id,
        gymId: admin.gymId,
        role: admin.role,
      },
      // Backwards compatibility alias
      admin: {
        _id: admin._id,
        id: admin.gymId,
        gymId: admin.gymId,
        role: admin.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error during authentication",
});
  }
};


// @desc    Get Current Authenticated Session Status
// @route   GET /api/auth/me (also GET /api/admin/me)
// @access  Private (HTTP-only cookie or Bearer JWT)
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.admin._id,
        gymId: req.admin.gymId,
        role: req.admin.role,
      },
      // Backwards compatibility alias
      admin: {
        _id: req.admin._id,
        id: req.admin.gymId,
        gymId: req.admin.gymId,
        role: req.admin.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching owner session",
});
  }
};

// @desc    Logout Owner & Clear HTTP-Only Session Cookie
// @route   POST /api/auth/logout (also POST /api/admin/logout)
// @access  Public / Private
export const logoutAdmin = async (req, res) => {
  res.clearCookie("gym_owner_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.clearCookie("token");

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

// @desc    Change Owner Password
// @route   PUT /api/auth/change-password
// @access  Private (HTTP-only cookie or Bearer JWT)
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Both current and new passwords are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    const admin = await Admin.findById(req.admin._id).select("+passwordHash");
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Owner account not found",
      });
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect current password",
      });
    }

    const salt = await bcrypt.genSalt(10);
    admin.passwordHash = await bcrypt.hash(newPassword, salt);
    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Owner password updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error changing password",
});
  }
};

// Helper function to seed default owner if none exists
export const seedDefaultOwner = async () => {
  try {
    const rawDefaultId = process.env.GYM_OWNER_ID || process.env.DEFAULT_OWNER_ID || "power house multi gym";
    const defaultNormalized = normalizeGymId(rawDefaultId);
    const defaultPass = process.env.GYM_OWNER_PASSWORD || process.env.DEFAULT_OWNER_PASS || "8123908513";

    if (!defaultPass) {
      return;
    }

    const existingOwnerCount = await Admin.countDocuments();
    if (existingOwnerCount > 0) {
      return;
    }

    const existingAdmin = await Admin.findOne({ normalizedGymId: defaultNormalized });
    if (existingAdmin) {
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPass, salt);
    await Admin.create({
      gymId: rawDefaultId.trim(),
      normalizedGymId: defaultNormalized,
      passwordHash: hashedPassword,
      role: "owner",
    });
    console.log(`First-time owner account '${defaultNormalized}' initialized with 15-day session configuration.`);
  } catch (err) {
    console.error("Error during initial owner initialization:", err.message);
  }
};
