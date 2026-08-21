import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, loadingMessage, isNetworkError, verifySession } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#0d0f17",
          color: "#fff",
          fontFamily: "'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "4px solid rgba(255, 255, 255, 0.1)",
            borderLeftColor: "#e63946",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
        <p style={{ marginTop: "1rem", color: "#a0aec0", fontSize: "0.95rem" }}>
          {loadingMessage}
        </p>
      </div>
    );
  }

  if (isNetworkError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#0d0f17",
          color: "#fff",
          fontFamily: "'Segoe UI', Roboto, sans-serif",
        }}
      >
        <p style={{ color: "#e63946", fontSize: "1.1rem", marginBottom: "1rem" }}>
          Unable to connect to the server. Please try again.
        </p>
        <button
          onClick={verifySession}
          style={{
            padding: "10px 20px",
            background: "#ffcc00",
            color: "#000",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
