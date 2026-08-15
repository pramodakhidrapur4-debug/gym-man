import React from "react";
import AllMember from "../AllMember/AllMember";

const PaymentPending = () => {
  return (
    <div>
      <h3 style={{ color: "#f59e0b", marginBottom: "1rem", fontFamily: "'Outfit', sans-serif" }}>
        ⚠️ Pending Payments Directory
      </h3>
      <AllMember initialFilter="pending" />
    </div>
  );
};

export default PaymentPending;
