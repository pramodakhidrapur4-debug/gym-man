import mongoose from "mongoose";

const PaymentTransactionSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Performance Indexes
PaymentTransactionSchema.index({ date: 1 });
PaymentTransactionSchema.index({ memberId: 1 });

const PaymentTransaction = mongoose.models.PaymentTransaction || mongoose.model("PaymentTransaction", PaymentTransactionSchema);

export default PaymentTransaction;
