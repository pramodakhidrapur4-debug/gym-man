import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const AdminSchema = new mongoose.Schema(
  {
    gymId: { type: String, required: true, trim: true },
    normalizedGymId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, default: "owner" },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Virtual property 'id' for backwards compatibility
AdminSchema.virtual("id").get(function () {
  return this.gymId || this.normalizedGymId;
});

AdminSchema.set("toJSON", { virtuals: true });
AdminSchema.set("toObject", { virtuals: true });

// Synchronous pre-save hook with explicit next callback for Mongoose middleware safety
AdminSchema.pre("save", function (next) {
  if (this.gymId) {
    this.normalizedGymId = this.gymId.trim().toLowerCase();
  }
  if (typeof next === "function") {
    next();
  }
});

// Method to compare candidate password with stored passwordHash
AdminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

const Admin = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);

export default Admin;