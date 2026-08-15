import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./Home/Home";
import Dashboard from "./Dashboard/Dashboard";
import ProtectedRoute from "./Components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";

// HomeRedirect component to handle root '/' routing safely
const HomeRedirect = () => {
  const { isAuthenticated, loading } = useAuth();

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
        <p style={{ marginTop: "1.2rem", color: "#8d97a5", fontSize: "0.95rem", fontWeight: "600" }}>
          Loading POWER HOUSE MULTI GYM...
        </p>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Home />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* Backwards compatibility alias for /Dash */}
          <Route
            path="/Dash"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;