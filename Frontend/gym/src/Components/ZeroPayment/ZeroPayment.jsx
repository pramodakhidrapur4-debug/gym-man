import React from "react";
import AllMember from "../AllMember/AllMember";

const ZeroPayment = () => {
  return (
    <div>
      <h3 style={{ color: "#ef4444", marginBottom: "1rem", fontFamily: "'Outfit', sans-serif" }}>
        ✖ Unpaid Members Directory
      </h3>
      <AllMember initialFilter="pending" />
    </div>
  );
};

export default ZeroPayment;
