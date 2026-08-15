import mongoose from "mongoose";

const MembSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    contact: { type: String, required: true, trim: true },
    picture: {
      type: String,
      default: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
    cloudinaryPublicId: { type: String, default: "" },
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },
    duration: { type: mongoose.Schema.Types.Mixed, default: 30 }, // Duration in DAYS (integer > 0)
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    pendingAmount: { type: Number, required: true, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["PAID", "PENDING"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

// Unified Date Comparison Rule (Shared Source of Truth)
MembSchema.virtual("membershipStatus").get(function () {
  if (!this.expiryDate) return "EXPIRED";
  const now = new Date();
  const exp = new Date(this.expiryDate);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const expEnd = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate(), 23, 59, 59, 999);

  return expEnd >= todayStart ? "ACTIVE" : "EXPIRED";
});

// Unified Days Remaining Output
MembSchema.virtual("daysRemaining").get(function () {
  if (!this.expiryDate) return "Expired";
  const now = new Date();
  const exp = new Date(this.expiryDate);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expStart = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());

  const diffMs = expStart.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} remaining`;
  } else if (diffDays === 0) {
    return "Expires today";
  } else {
    const absDays = Math.abs(diffDays);
    return `Expired ${absDays} day${absDays === 1 ? "" : "s"} ago`;
  }
});

// Enable virtuals in JSON outputs
MembSchema.set("toJSON", { virtuals: true });
MembSchema.set("toObject", { virtuals: true });

// Synchronous pre-save hook with explicit next callback for Mongoose middleware safety
MembSchema.pre("save", function (next) {
  const total = Number(this.totalAmount) || 0;
  const paid = Number(this.paidAmount) || 0;

  // Enforce zero floor for pendingAmount
  const pending = Math.max(0, total - paid);
  this.pendingAmount = pending;

  // Determine Payment Status: PAID when pendingAmount === 0, else PENDING
  if (pending === 0 && total > 0) {
    this.paymentStatus = "PAID";
  } else {
    this.paymentStatus = "PENDING";
  }
  if (typeof next === "function") {
    next();
  }
});

const Member = mongoose.models.Member || mongoose.model("Member", MembSchema);

export default Member;
