import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

import { API_BASE_URL } from "../config";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("gym_owner_token"));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Check auth session validity on application load (GET /api/auth/me)
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem("gym_owner_token");

      try {
        const headers = {
          "Content-Type": "application/json",
        };
        if (storedToken) {
          headers["Authorization"] = `Bearer ${storedToken}`;
        }

        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: "GET",
          headers,
          credentials: "include", // Pass HTTP-only session cookies
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const activeUser = data.user || data.admin;
          setUser(activeUser);
          setIsAuthenticated(true);
        } else {
          // 401 Session expired or invalid
          localStorage.removeItem("gym_owner_token");
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Session verification failed:", err);
        localStorage.removeItem("gym_owner_token");
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  // Login handler
  const login = async (gymId, password) => {
    setAuthError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Set HTTP-only session cookie
        body: JSON.stringify({ gymId, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const msg = data.message || "Invalid gym ID or password.";
        setAuthError(msg);
        setLoading(false);
        return { success: false, message: msg };
      }

      // Successful login
      if (data.token) {
        localStorage.setItem("gym_owner_token", data.token);
        setToken(data.token);
      }

      const activeUser = data.user || data.admin;
      setUser(activeUser);
      setIsAuthenticated(true);
      setLoading(false);
      return { success: true, message: data.message };
    } catch (err) {
      console.error("Login network error:", err);
      const msg = "Unable to connect to authentication server. Please try again.";
      setAuthError(msg);
      setLoading(false);
      return { success: false, message: msg };
    }
  };

  // Change password handler
  const changeOwnerPassword = async (currentPassword, newPassword) => {
    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();
      return { success: response.ok && data.success, message: data.message };
    } catch (err) {
      return { success: false, message: "Network error during password update." };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout request error:", err);
    } finally {
      localStorage.removeItem("gym_owner_token");
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError("");
    }
  };

  const clearError = () => setAuthError("");

  return (
    <AuthContext.Provider
      value={{
        user,
        admin: user, // Alias for backwards compatibility
        token,
        isAuthenticated,
        loading,
        authError,
        login,
        changeOwnerPassword,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
