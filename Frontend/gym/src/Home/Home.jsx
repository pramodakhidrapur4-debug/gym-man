import React from "react";
import Log from "../Components/logpage/Log";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

const Home = () => {
  const { isAuthenticated, loading, loadingMessage, isNetworkError, verifySession } = useAuth();

  // 1. While checking GET /api/auth/me session: Render professional loading screen
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#090b0e",
          color: "#fff",
          fontFamily: "'Outfit', 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            border: "4px solid rgba(255, 204, 0, 0.15)",
            borderLeftColor: "#ffcc00",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
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
        <p style={{ marginTop: "1.2rem", color: "#8d97a5", fontSize: "0.95rem", fontWeight: "600", letterSpacing: "0.5px" }}>
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
          backgroundColor: "#090b0e",
          color: "#fff",
          fontFamily: "'Outfit', 'Segoe UI', Roboto, sans-serif",
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

  // 2. If authenticated session is valid: Automatically redirect to /dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // 3. Only show login form if session is invalid / expired
  return (
    <div className="homee">
      <Log />
    </div>
  );
};

export default Home;