import React, { useState, useEffect } from "react";
import "./Landing.css";
import AllMember from "../AllMember/AllMember";
import NewMember from "../NewMember/NewMember";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const [activeFilter, setActiveFilter] = useState("all"); // "all", "active", "expired", "paid", "pending", "new"
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [passData, setPassData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passStatus, setPassStatus] = useState({ type: "", msg: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState("all");

  // Dynamic Dashboard Stats State from MongoDB
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0,
    fullyPaidMembers: 0,
    pendingMembers: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    todayIncome: 0,
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");

  const { admin, token, logout, changeOwnerPassword } = useAuth();
  const navigate = useNavigate();

  const fetchDashboardStats = async () => {
    setLoadingStats(true);
    setStatsError("");
    try {
      const headers = { "Content-Type": "application/json" };
      const storedToken = token || localStorage.getItem("gym_owner_token");
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

      const response = await fetch(`${API_BASE_URL}/dashboard`, {
        method: "GET",
        headers,
        credentials: "include",
      });

      const data = await response.json();
      if (response.ok && data.success && data.stats) {
        setStats(data.stats);
      } else {
        setStatsError(data.message || "Unable to load dashboard metrics.");
      }
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      setStatsError("Unable to connect to backend server.");
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();

    // 1. Refresh on tab visibility return
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchDashboardStats();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 2. Refresh at exactly midnight IST
    let timeoutId;
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(now.getTime() + istOffset);
      
      const nextMidnightIST = new Date(istNow);
      nextMidnightIST.setUTCHours(24, 0, 0, 0);

      const msUntilMidnight = nextMidnightIST.getTime() - istNow.getTime();

      timeoutId = setTimeout(() => {
        fetchDashboardStats();
        scheduleMidnightRefresh();
      }, msUntilMidnight + 1000);
    };

    scheduleMidnightRefresh();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(timeoutId);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const formatRupee = (amount) => {
    const num = Number(amount) || 0;
    return `₹${num.toLocaleString("en-IN")}`;
  };

  const handlePassChange = async (e) => {
    e.preventDefault();
    setPassStatus({ type: "", msg: "" });

    if (!passData.currentPassword || !passData.newPassword) {
      setPassStatus({ type: "error", msg: "Please fill in all password fields." });
      return;
    }

    if (passData.newPassword !== passData.confirmPassword) {
      setPassStatus({ type: "error", msg: "New passwords do not match." });
      return;
    }

    if (passData.newPassword.length < 6) {
      setPassStatus({ type: "error", msg: "Password must be at least 6 characters." });
      return;
    }

    setIsUpdating(true);
    const res = await changeOwnerPassword(passData.currentPassword, passData.newPassword);
    setIsUpdating(false);

    if (res.success) {
      setPassStatus({ type: "success", msg: "Password updated successfully!" });
      setTimeout(() => {
        setShowPwdModal(false);
        setPassData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setPassStatus({ type: "", msg: "" });
      }, 1500);
    } else {
      setPassStatus({ type: "error", msg: res.message || "Failed to update password." });
    }
  };

  return (
    <div className="manage">
      {/* Top Owner Navigation Header */}
      <header className="owner-header-bar">
        <div className="owner-brand">
          <h2>POWER HOUSE MULTI GYM</h2>
          <span className="owner-badge">
            Gym ID: <strong>{admin?.gymId || admin?.id || "power house multi gym"}</strong> | Status: <span className="status-online">● Authenticated</span>
          </span>
        </div>
        <div className="owner-header-actions">
          <button onClick={() => setShowPwdModal(true)} className="change-pwd-btn">
            🔑 Change Password
          </button>
          <button onClick={handleLogout} className="logout-btn">
            🔒 Logout
          </button>
        </div>
      </header>

      {/* Change Password Modal */}
      {showPwdModal && (
        <div className="pwd-modal-overlay">
          <div className="pwd-modal-card premium-glass-card">
            <div className="pwd-modal-header">
              <h3><span className="header-icon">🔒</span> Change Owner Password</h3>
              <button onClick={() => setShowPwdModal(false)} className="close-modal-btn">✕</button>
            </div>
            {passStatus.msg && (
              <div className={`modal-alert ${passStatus.type}`}>
                {passStatus.msg}
              </div>
            )}
            <form onSubmit={handlePassChange} className="pwd-modal-form">
              <div className="input-group">
                <label>Current Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔑</span>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={passData.currentPassword}
                    onChange={(e) => setPassData({ ...passData, currentPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>New Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">✨</span>
                  <input
                    type="password"
                    placeholder="Enter new password (min 6 chars)"
                    value={passData.newPassword}
                    onChange={(e) => setPassData({ ...passData, newPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Confirm New Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">✓</span>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={passData.confirmPassword}
                    onChange={(e) => setPassData({ ...passData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="pwd-modal-actions">
                <button type="button" onClick={() => setShowPwdModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" disabled={isUpdating} className="save-pwd-btn premium-btn">
                  {isUpdating ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="dashboard-sub-header">
        <div className="dashboard-title-box">
          <h1>Owner Control Dashboard</h1>
          <p>Real-time analytics and member management for POWER HOUSE MULTI GYM</p>
        </div>
      </div>

      {statsError && (
        <div className="stats-error-banner">
          <span>⚠️ {statsError}</span>
          <button onClick={fetchDashboardStats} className="retry-btn">Retry Loading</button>
        </div>
      )}

      {/* Clickable Primary Statistic Cards Grid */}
      <section className="stats-grid-container">
        {/* Card 1: Total Members */}
        <div
          className={`stat-card card-total ${activeFilter === "all" ? "active-card" : ""}`}
          onClick={() => setActiveFilter("all")}
          role="button"
          tabIndex="0"
        >
          <div className="stat-card-icon">👥</div>
          <div className="stat-card-content">
            <span className="stat-label">Total Members</span>
            <h3 className="stat-value">{loadingStats ? "..." : stats.totalMembers}</h3>
            <span className="click-hint">Click to show all</span>
          </div>
        </div>

        {/* Card 2: Active Members */}
        <div
          className={`stat-card card-active ${activeFilter === "active" ? "active-card" : ""}`}
          onClick={() => setActiveFilter("active")}
          role="button"
          tabIndex="0"
        >
          <div className="stat-card-icon">🟢</div>
          <div className="stat-card-content">
            <span className="stat-label">Active Members</span>
            <h3 className="stat-value">{loadingStats ? "..." : stats.activeMembers}</h3>
            <span className="click-hint">Click to filter active</span>
          </div>
        </div>

        {/* Card 3: Expired Members */}
        <div
          className={`stat-card card-expired ${activeFilter === "expired" ? "active-card" : ""}`}
          onClick={() => setActiveFilter("expired")}
          role="button"
          tabIndex="0"
        >
          <div className="stat-card-icon">🔴</div>
          <div className="stat-card-content">
            <span className="stat-label">Expired Members</span>
            <h3 className="stat-value">{loadingStats ? "..." : stats.expiredMembers}</h3>
            <span className="click-hint">Click to filter expired</span>
          </div>
        </div>

        {/* Card 4: Payment Done */}
        <div
          className={`stat-card card-paid ${activeFilter === "paid" ? "active-card" : ""}`}
          onClick={() => setActiveFilter("paid")}
          role="button"
          tabIndex="0"
        >
          <div className="stat-card-icon">💳</div>
          <div className="stat-card-content">
            <span className="stat-label">Payment Done</span>
            <h3 className="stat-value">{loadingStats ? "..." : stats.fullyPaidMembers}</h3>
            <span className="click-hint">Click to filter fully paid</span>
          </div>
        </div>

        {/* Card 5: Payment Pending */}
        <div
          className={`stat-card card-pending ${activeFilter === "pending" ? "active-card" : ""}`}
          onClick={() => setActiveFilter("pending")}
          role="button"
          tabIndex="0"
        >
          <div className="stat-card-icon">⚠️</div>
          <div className="stat-card-content">
            <span className="stat-label">Payment Pending</span>
            <h3 className="stat-value">{loadingStats ? "..." : stats.pendingMembers}</h3>
            <span className="click-hint">Click to filter pending</span>
          </div>
        </div>

        {/* Financial Card 6: Total Revenue */}
        <div className="stat-card card-revenue">
          <div className="stat-card-icon">💰</div>
          <div className="stat-card-content">
            <span className="stat-label">Total Revenue</span>
            <h3 className="stat-value revenue-text">{loadingStats ? "..." : formatRupee(stats.totalRevenue)}</h3>
            <span className="revenue-sub">Collected Payments</span>
          </div>
        </div>

        {/* Financial Card 7: Pending Revenue */}
        <div className="stat-card card-pending-revenue">
          <div className="stat-card-icon">⏳</div>
          <div className="stat-card-content">
            <span className="stat-label">Pending Revenue</span>
            <h3 className="stat-value pending-revenue-text">{loadingStats ? "..." : formatRupee(stats.pendingRevenue)}</h3>
            <span className="revenue-sub">Outstanding Balances</span>
          </div>
        </div>

        {/* Financial Card 8: Today's Income */}
        <div className="stat-card card-today-income">
          <div className="stat-card-icon">💵</div>
          <div className="stat-card-content">
            <span className="stat-label">TODAY'S INCOME</span>
            <h3 className="stat-value" style={{ color: "#00E676" }}>{loadingStats ? "..." : formatRupee(stats.todayIncome)}</h3>
            <span className="revenue-sub">Collected Today</span>
          </div>
        </div>

        {/* Card 9: Selected Duration Members */}
        <div className="stat-card card-duration">
          <div className="stat-card-icon">📅</div>
          <div className="stat-card-content">
            <span className="stat-label">
              {selectedDuration === "all" ? "MEMBERS BY PLAN" :
               selectedDuration === "12" ? "1 YEAR MEMBERS" :
               `${selectedDuration} MONTH MEMBERS`}
            </span>
            <h3 className="stat-value">
              {loadingStats ? "..." : (selectedDuration === "all" ? "—" : stats.durationStats?.[selectedDuration] || 0)}
            </h3>
            <span className="revenue-sub">
              {selectedDuration === "all" ? "Select a Duration" : "Active Members in This Plan"}
            </span>
          </div>
        </div>
      </section>

      {/* Action Bar (Below Stats, Above Content) */}
      <div className="dashboard-action-bar">
        <button
          onClick={() => setActiveFilter(activeFilter === "new" ? "all" : "new")}
          className="add-member-primary-btn"
        >
          {activeFilter === "new" ? "📋 Back to Members List" : "➕ Register New Member"}
        </button>
      </div>

      {/* Main Dynamic Workspace Below Cards */}
      <main className="dashboard-content-area">
        {activeFilter === "new" ? (
          <NewMember
            onMemberAdded={() => {
              fetchDashboardStats();
              setActiveFilter("all");
            }}
          />
        ) : (
          <AllMember
            initialFilter={activeFilter}
            onMemberUpdated={fetchDashboardStats}
            onDurationFilterChange={setSelectedDuration}
          />
        )}
      </main>
    </div>
  );
};

export default Landing;
