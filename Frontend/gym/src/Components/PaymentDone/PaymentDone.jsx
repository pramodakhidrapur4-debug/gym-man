import React from "react";
import AllMember from "../AllMember/AllMember";

const PaymentDone = () => {
  return (
    <div>
      <h3 style={{ color: "#22c55e", marginBottom: "1rem", fontFamily: "'Outfit', sans-serif" }}>
        ✅ Fully Paid Members Directory
      </h3>
      <AllMember initialFilter="paid" />
    </div>
  );
};

export default PaymentDone;
