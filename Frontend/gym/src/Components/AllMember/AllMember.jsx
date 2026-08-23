import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./AllMember.css";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config";
import { fetchWithRetry } from "../../utils/fetchWithRetry";
import { formatDisplayDate } from "../../utils/dateUtils";
import ControlledDateInput from "../ControlledDateInput";

const SelectAllCheckbox = ({ allSelected, someSelected, onChange }) => {
  const checkboxRef = React.useRef(null);
  React.useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return (
    <div className="checkbox-touch-target" onClick={(e) => e.stopPropagation()}>
      <input 
        type="checkbox" 
        className="custom-checkbox"
        ref={checkboxRef}
        checked={allSelected} 
        onChange={onChange} 
        aria-label="Select all visible members"
      />
    </div>
  );
};

const AllMember = ({ initialFilter = "all", onMemberUpdated, onDurationFilterChange }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState(""); // For debouncing
  const [filter, setFilter] = useState(initialFilter);
  const [durationFilter, setDurationFilter] = useState("all");
  const [isDurationMenuOpen, setIsDurationMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [viewingMember, setViewingMember] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [initialEditState, setInitialEditState] = useState(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState(null);
  const [paymentModalMember, setPaymentModalMember] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  
  // Touch Handlers for Long Press
  const timerRef = React.useRef(null);
  const isLongPressRef = React.useRef(false);
  const touchPosRef = React.useRef({ x: 0, y: 0 });

  // Feedback & Toast state
  const [addPaymentAmount, setAddPaymentAmount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);

  const { token } = useAuth();

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3500);
  };

  // Leading zero normalization helper
  const normalizeNumericInput = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str === "") return "";
    return str.replace(/^0+(?=\d)/, "");
  };

  useEffect(() => {
    setFilter(initialFilter);
    setDurationFilter("all");
    setPage(1);
  }, [initialFilter]);

  // Body Scroll Locking when any modal/lightbox is open
  const isAnyModalOpen = Boolean(
    viewingMember || editingMember || deleteConfirmMember || paymentModalMember || lightboxImage || showUnsavedConfirm || bulkDeleteConfirm
  );
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isAnyModalOpen]);

  const durationDropdownRef = React.useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (durationDropdownRef.current && !durationDropdownRef.current.contains(event.target)) {
        setIsDurationMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openEditModal = useCallback((m) => {
    const formattedDate = m.startDate ? new Date(m.startDate).toISOString().split("T")[0] : "";
    const editData = {
      ...m,
      startDate: formattedDate,
      totalAmountInput: String(m.totalAmount ?? ""),
      paidAmountInput: String(m.paidAmount ?? ""),
      durationInput: String(m.duration ?? "30"),
      batch: m.batch ?? "Morning",
      timeSlot: m.timeSlot ?? "",
    };
    setEditingMember(editData);
    setInitialEditState(editData);
    setEditPhotoPreview(null);
    setActionError("");
  }, []);

  const isEditDirty = () => {
    if (!editingMember || !initialEditState) return false;
    if (editPhotoPreview) return true;
    return (
      editingMember.name !== initialEditState.name ||
      editingMember.contact !== initialEditState.contact ||
      editingMember.startDate !== initialEditState.startDate ||
      editingMember.totalAmountInput !== initialEditState.totalAmountInput ||
      editingMember.paidAmountInput !== initialEditState.paidAmountInput ||
      editingMember.durationInput !== initialEditState.durationInput ||
      editingMember.batch !== initialEditState.batch ||
      editingMember.timeSlot !== initialEditState.timeSlot
    );
  };

  const attemptCloseEditModal = () => {
    if (isEditDirty()) {
      setShowUnsavedConfirm(true);
    } else {
      forceCloseEditModal();
    }
  };

  const forceCloseEditModal = () => {
    setEditingMember(null);
    setInitialEditState(null);
    setShowUnsavedConfirm(false);
    setEditPhotoPreview(null);
    setActionError("");
  };

  // ESC Key listener for Modals & Lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isDurationMenuOpen) setIsDurationMenuOpen(false);
        else if (lightboxImage) setLightboxImage(null);
        else if (showUnsavedConfirm) setShowUnsavedConfirm(false);
        else if (editingMember) attemptCloseEditModal();
        else if (viewingMember) setViewingMember(null);
        else if (deleteConfirmMember) setDeleteConfirmMember(null);
        else if (bulkDeleteConfirm) setBulkDeleteConfirm(false);
        else if (paymentModalMember) setPaymentModalMember(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage, showUnsavedConfirm, editingMember, initialEditState, viewingMember, deleteConfirmMember, bulkDeleteConfirm, paymentModalMember, editPhotoPreview, isDurationMenuOpen]);

  const fetchMembers = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const headers = { "Content-Type": "application/json" };
      const storedToken = token || localStorage.getItem("gym_owner_token");
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

      let url = `${API_BASE_URL}/members`;
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("limit", 8);

      if (filter && filter !== "all") params.append("filter", filter);
      if (durationFilter && durationFilter !== "all") params.append("durationFilter", durationFilter);
      if (search.trim()) params.append("search", search.trim());

      url += `?${params.toString()}`;

      const response = await fetchWithRetry(url, {
        method: "GET",
        headers,
        credentials: "include",
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setMembers(data.members || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error("Fetch members error:", err);
      showToast("Failed to fetch members. Please check your connection.");
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers(true);
  }, [filter, durationFilter, search, page]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (search !== searchInput) {
        setSearch(searchInput);
        setPage(1);
      }
    }, 400); // 400ms delay
    
    return () => {
      clearTimeout(handler);
    };
  }, [searchInput, search]);

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleDurationChange = (val) => {
    setDurationFilter(val);
    setPage(1);
    if (onDurationFilterChange) {
      onDurationFilterChange(val);
    }
  };

  const handleSelectAllVisible = () => {
    if (members.length === 0) return;
    const visibleIds = members.map((m) => m._id);
    const allVisibleSelected = visibleIds.every((id) => selectedMembers.includes(id));
    
    if (allVisibleSelected) {
      setSelectedMembers((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedMembers((prev) => {
        const newSet = new Set(prev);
        visibleIds.forEach((id) => newSet.add(id));
        return Array.from(newSet);
      });
    }
  };

  const handleSelectMember = (id) => {
    setSelectedMembers((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedMembers([]);
  };

  // ----------------------------------------------------
  // Long-Press Implementation
  // ----------------------------------------------------
  const startPress = (e, member) => {
    if (isSelectionMode) return;
    isLongPressRef.current = false;
    touchPosRef.current = { x: e.clientX, y: e.clientY };
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      setIsSelectionMode(true);
      setSelectedMembers([member._id]);
    }, 700);
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onPointerMove = (e) => {
    if (!timerRef.current) return;
    const dx = Math.abs(e.clientX - touchPosRef.current.x);
    const dy = Math.abs(e.clientY - touchPosRef.current.y);
    if (dx > 15 || dy > 15) {
      cancelPress();
    }
  };

  const handleRowClick = (e, member) => {
    if (isSelectionMode) {
      // In selection mode, tapping anywhere on row toggles selection
      e.preventDefault();
      handleSelectMember(member._id);
      return;
    }
    if (isLongPressRef.current) {
      // If a long press just finished, don't trigger the click
      e.preventDefault();
      isLongPressRef.current = false;
      return;
    }
    setViewingMember(member);
  };
  // ----------------------------------------------------

  const handleBulkDelete = async () => {
    if (selectedMembers.length === 0) return;
    
    setActionError("");
    setActionLoading(true);
    try {
      const headers = { "Content-Type": "application/json" };
      const storedToken = token || localStorage.getItem("gym_owner_token");
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

      const response = await fetch(`${API_BASE_URL}/members/bulk-delete`, {
        method: "DELETE",
        headers,
        credentials: "include",
        body: JSON.stringify({ memberIds: selectedMembers }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        showToast(`${data.deletedCount || selectedMembers.length} members permanently removed`);
        setMembers((prev) => prev.filter((m) => !selectedMembers.includes(m._id)));
        setTotalCount((prev) => Math.max(0, prev - selectedMembers.length));
        setBulkDeleteConfirm(false);
        cancelSelectionMode();
        fetchMembers(false);
        if (onMemberUpdated) onMemberUpdated();
      } else {
        setActionError(data.message || "Failed to delete selected members");
      }
    } catch (err) {
      setActionError(err.message || "Network error while bulk deleting members");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setActionError("");
    setActionLoading(true);
    try {
      const headers = { "Content-Type": "application/json" };
      const storedToken = token || localStorage.getItem("gym_owner_token");
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

      const response = await fetch(`${API_BASE_URL}/members/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      const data = await response.json();
      if (response.ok && data.success) {
        showToast("Member permanently removed");
        setMembers((prev) => prev.filter((m) => m._id !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setDeleteConfirmMember(null);
        setViewingMember(null);
        fetchMembers(false);
        if (onMemberUpdated) onMemberUpdated();
      } else {
        setActionError(data.message || "Failed to delete member");
      }
    } catch (err) {
      setActionError(err.message || "Network error while deleting member");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setActionError("");

    const durDays = parseInt(editingMember.durationInput, 10);
    if (isNaN(durDays) || durDays <= 0) {
      setActionError("Duration must be a positive integer (at least 1 day).");
      return;
    }

    const totalNum = editingMember.totalAmountInput === "" ? 0 : Number(editingMember.totalAmountInput);
    const paidNum = editingMember.paidAmountInput === "" ? 0 : Number(editingMember.paidAmountInput);

    if (isNaN(totalNum) || totalNum < 0) {
      setActionError("Total fee must be a valid non-negative number.");
      return;
    }

    if (isNaN(paidNum) || paidNum < 0) {
      setActionError("Paid amount must be a valid non-negative number.");
      return;
    }

    if (paidNum > totalNum) {
      setActionError("Paid amount cannot exceed total fee.");
      return;
    }

    setActionLoading(true);
    try {
      const headers = { "Content-Type": "application/json" };
      const storedToken = token || localStorage.getItem("gym_owner_token");
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

      const payload = {
        name: editingMember.name.trim(),
        contact: editingMember.contact.trim(),
        startDate: editingMember.startDate,
        // Zero-pad the duration to bypass the old Render backend bug where "1" evaluates to 30 days
        duration: `0${durDays}`,
        batch: editingMember.batch,
        timeSlot: editingMember.timeSlot.trim(),
        totalAmount: totalNum,
        paidAmount: paidNum,
      };

      if (editPhotoPreview) {
        payload.picture = editPhotoPreview;
      }

      const response = await fetch(`${API_BASE_URL}/members/${editingMember._id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        showToast("Member updated successfully!");
        forceCloseEditModal();
        fetchMembers(false);
        if (onMemberUpdated) onMemberUpdated();
      } else {
        setActionError(data.message || "Failed to update member");
      }
    } catch (err) {
      setActionError("Unable to save changes. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    const paymentVal = Number(addPaymentAmount);
    if (isNaN(paymentVal) || paymentVal <= 0) {
      setActionError("Please enter a valid positive payment amount.");
      return;
    }

    const currentPaid = Number(paymentModalMember.paidAmount) || 0;
    const newPaidTotal = currentPaid + paymentVal;

    if (newPaidTotal > Number(paymentModalMember.totalAmount)) {
      setActionError("Paid amount cannot exceed total fee.");
      return;
    }

    setActionLoading(true);
    try {
      const headers = { "Content-Type": "application/json" };
      const storedToken = token || localStorage.getItem("gym_owner_token");
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

      const response = await fetch(`${API_BASE_URL}/members/${paymentModalMember._id}`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ paidAmount: newPaidTotal }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        showToast("Payment recorded successfully!");
        setPaymentModalMember(null);
        setAddPaymentAmount("");
        fetchMembers(false);
        if (onMemberUpdated) onMemberUpdated();
      } else {
        setActionError(data.message || "Failed to record payment.");
      }
    } catch (err) {
      setActionError("Error recording payment");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return formatDisplayDate(dateStr);
  };

  const getInitials = (nameStr) => {
    if (!nameStr) return "PK";
    const parts = nameStr.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nameStr.substring(0, 2).toUpperCase();
  };

  const getMembershipStatus = (expiryDate) => {
    if (!expiryDate) return { status: "EXPIRED", text: "Expired" };
    
    const now = new Date();
    const exp = new Date(expiryDate);
    
    const diffMs = exp.getTime() - now.getTime();
    
    if (diffMs > 0) {
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return { status: "ACTIVE", text: `${diffDays} day${diffDays === 1 ? "" : "s"} remaining` };
    } else {
      const absDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
      if (absDays === 0) {
        return { status: "EXPIRED", text: "Expired today" };
      }
      return { status: "EXPIRED", text: `Expired ${absDays} day${absDays === 1 ? "" : "s"} ago` };
    }
  };

  const calculateEditExpiryPreviewDate = () => {
    if (!editingMember || !editingMember.startDate) return null;
    try {
      const start = new Date(editingMember.startDate);
      if (isNaN(start.getTime())) return null;
      const days = parseInt(editingMember.durationInput, 10);
      if (isNaN(days) || days <= 0) return null;

      const utcStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      utcStart.setUTCDate(utcStart.getUTCDate() + days);
      
      return utcStart;
    } catch {
      return null;
    }
  };

  // Live calculation of expected expiry date in Edit Form (returns string for display)
  const calculateEditExpiryPreview = () => {
    const previewDate = calculateEditExpiryPreviewDate();
    if (!previewDate) return "N/A";
    return formatDisplayDate(previewDate);
  };

  const calculateEditPendingPreview = () => {
    if (!editingMember) return 0;
    const total = editingMember.totalAmountInput === "" ? 0 : Number(editingMember.totalAmountInput) || 0;
    const paid = editingMember.paidAmountInput === "" ? 0 : Number(editingMember.paidAmountInput) || 0;
    return Math.max(0, total - paid);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setActionError("Please select a valid image file (JPG, PNG, WebP).");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setActionError("Image size must be less than 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="all-members-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <span>✨ {toastMessage}</span>
        </div>
      )}

      {/* Controls: Search Bar + Filter Pills */}
      <div className="controls-header">
        <div className="search-box">
          <span className="search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchInput}
            onChange={handleSearchChange}
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
              className="clear-search"
              title="Clear search"
              aria-label="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        <div className="filter-pills">
          <button className={`filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => handleFilterChange("all")}>All</button>
          <button className={`filter-pill ${filter === "active" ? "active" : ""}`} onClick={() => handleFilterChange("active")}>Active</button>
          <button className={`filter-pill ${filter === "expired" ? "active" : ""}`} onClick={() => handleFilterChange("expired")}>Expired</button>
          <button className={`filter-pill ${filter === "paid" ? "active" : ""}`} onClick={() => handleFilterChange("paid")}>Paid</button>
          <button className={`filter-pill ${filter === "pending" ? "active" : ""}`} onClick={() => handleFilterChange("pending")}>Pending</button>
          
          <div className="custom-dropdown-container" ref={durationDropdownRef}>
            <button 
              type="button" 
              className={`filter-pill custom-dropdown-trigger ${durationFilter !== "all" ? "active" : ""}`}
              onClick={() => setIsDurationMenuOpen(!isDurationMenuOpen)}
            >
              {durationFilter === "all" ? "All Durations" : 
               durationFilter === "12" ? "12 Months (1 Year)" : 
               `${durationFilter} Month${durationFilter === "1" ? "" : "s"}`}
              <svg className={`chevron ${isDurationMenuOpen ? "open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            
            {isDurationMenuOpen && (
              <div className="custom-dropdown-menu">
                <button type="button" className={`dropdown-item ${durationFilter === "all" ? "selected" : ""}`} onClick={() => { handleDurationChange("all"); setIsDurationMenuOpen(false); }}>
                  <span className="check-placeholder">{durationFilter === "all" ? "✓" : ""}</span> All Durations
                </button>
                <button type="button" className={`dropdown-item ${durationFilter === "1" ? "selected" : ""}`} onClick={() => { handleDurationChange("1"); setIsDurationMenuOpen(false); }}>
                  <span className="check-placeholder">{durationFilter === "1" ? "✓" : ""}</span> 1 Month
                </button>
                <button type="button" className={`dropdown-item ${durationFilter === "3" ? "selected" : ""}`} onClick={() => { handleDurationChange("3"); setIsDurationMenuOpen(false); }}>
                  <span className="check-placeholder">{durationFilter === "3" ? "✓" : ""}</span> 3 Months
                </button>
                <button type="button" className={`dropdown-item ${durationFilter === "6" ? "selected" : ""}`} onClick={() => { handleDurationChange("6"); setIsDurationMenuOpen(false); }}>
                  <span className="check-placeholder">{durationFilter === "6" ? "✓" : ""}</span> 6 Months
                </button>
                <button type="button" className={`dropdown-item ${durationFilter === "12" ? "selected" : ""}`} onClick={() => { handleDurationChange("12"); setIsDurationMenuOpen(false); }}>
                  <span className="check-placeholder">{durationFilter === "12" ? "✓" : ""}</span> 12 Months (1 Year)
                </button>
              </div>
            )}
          </div>

          <button 
            className={`filter-pill select-toggle-btn ${isSelectionMode ? "active" : ""}`} 
            onClick={() => {
              if (isSelectionMode) {
                cancelSelectionMode();
              } else {
                setIsSelectionMode(true);
              }
            }}
            title="Toggle Selection Mode"
          >
            {isSelectionMode ? "Cancel Select" : "Select"}
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {isSelectionMode && (
        <div className="bulk-actions-bar">
          <div className="bulk-actions-left">
            <button className="cancel-selection-btn" onClick={cancelSelectionMode}>
              Clear
            </button>
            <button className="select-all-btn" onClick={handleSelectAllVisible}>
              {members.length > 0 && members.every((m) => selectedMembers.includes(m._id)) ? "Unselect Visible" : "Select All"}
            </button>
            <span className="bulk-selected-text">
              {selectedMembers.length} Selected
            </span>
          </div>
          {selectedMembers.length > 0 && (
            <button 
              className="bulk-delete-btn" 
              onClick={() => setBulkDeleteConfirm(true)}
              disabled={actionLoading}
            >
              Delete Selected
            </button>
          )}
        </div>
      )}

      {actionError && <div className="alert-banner error">{actionError}</div>}

      {/* Content Area */}
      {loading ? (
        <div className="members-loading">
          <div className="spinner"></div>
          <p>Loading members...</p>
        </div>
      ) : members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No matching members found</h3>
          <p>{search ? `No members match "${search}"` : `No members match the selected "${filter}" category.`}</p>
          {search && (
            <button
              onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
              className="clear-search-btn"
              style={{ marginTop: "1rem", padding: "8px 16px", background: "rgba(255, 204, 0, 0.15)", border: "1px solid #ffcc00", color: "#ffea75", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="desktop-table-container">
            <table className="members-table">
              <thead>
                <tr>
                  {isSelectionMode && (
                    <th className="checkbox-cell">
                      <SelectAllCheckbox
                        allSelected={members.length > 0 && members.every((m) => selectedMembers.includes(m._id))}
                        someSelected={members.some((m) => selectedMembers.includes(m._id)) && !members.every((m) => selectedMembers.includes(m._id))}
                        onChange={handleSelectAllVisible}
                      />
                    </th>
                  )}
                  <th>Member Profile</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Expiry & Days</th>
                  <th>Fee Summary</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const { status: memStatus, text: memDaysText } = getMembershipStatus(m.expiryDate);
                  return (
                  <tr 
                    key={m._id} 
                    className={`clickable-row ${selectedMembers.includes(m._id) ? "row-selected" : ""}`}
                    onClick={(e) => handleRowClick(e, m)}
                    onPointerDown={(e) => startPress(e, m)}
                    onPointerUp={cancelPress}
                    onPointerCancel={cancelPress}
                    onPointerLeave={cancelPress}
                    onPointerMove={onPointerMove}
                  >
                    {isSelectionMode && (
                      <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="checkbox-touch-target">
                          <input 
                            type="checkbox" 
                            className="custom-checkbox"
                            onChange={() => handleSelectMember(m._id)} 
                            checked={selectedMembers.includes(m._id)} 
                          />
                        </div>
                      </td>
                    )}
                    <td className="member-cell">
                      <div className="member-avatar-wrapper">
                        <img
                          src={m.picture}
                          alt={m.name}
                          loading="lazy"
                          className="member-avatar"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = "flex";
                          }}
                        />
                        <div className="initials-avatar" style={{ display: m.picture ? "none" : "flex" }}>
                          {getInitials(m.name)}
                        </div>
                      </div>
                      <div className="member-info-text">
                        <strong className="member-name-link">{m.name}</strong>
                      </div>
                    </td>
                    <td>{m.contact}</td>
                    <td>
                      <span className={`status-badge ${memStatus}`}>
                        {memStatus === "ACTIVE" ? "● Active" : "✖ Expired"}
                      </span>
                    </td>
                    <td>
                      <div className="expiry-cell">
                        <span>{formatDate(m.expiryDate)}</span>
                        <small className={memStatus === "ACTIVE" ? "days-active" : "days-expired"}>
                          {memDaysText}
                        </small>
                      </div>
                    </td>
                    <td>
                      <div className="fee-cell">
                        <span>Total: ₹{m.totalAmount}</span>
                        <small className="pending-text">Pending: ₹{m.pendingAmount}</small>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${m.paymentStatus}`}>
                        {m.paymentStatus === "PAID" ? "PAID" : "PENDING"}
                      </span>
                    </td>
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setViewingMember(m)} className="action-btn view" title="View Profile Modal">👁️</button>
                      <button onClick={() => { setPaymentModalMember(m); setAddPaymentAmount(""); setActionError(""); }} className="action-btn pay" title="Record Payment">💳</button>
                      <button onClick={() => openEditModal(m)} className="action-btn edit" title="Edit Member">✏️</button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="mobile-cards-container">
            {members.map((m) => {
              const { status: memStatus, text: memDaysText } = getMembershipStatus(m.expiryDate);
              return (
              <div 
                className={`mobile-member-card ${selectedMembers.includes(m._id) ? "card-selected" : ""}`} 
                key={m._id} 
                onClick={(e) => handleRowClick(e, m)}
                onPointerDown={(e) => startPress(e, m)}
                onPointerUp={cancelPress}
                onPointerCancel={cancelPress}
                onPointerLeave={cancelPress}
                onPointerMove={onPointerMove}
              >
                {isSelectionMode && (
                  <div className="mobile-card-checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                    <div className="checkbox-touch-target">
                      <input 
                        type="checkbox" 
                        className="custom-checkbox"
                        onChange={() => handleSelectMember(m._id)} 
                        checked={selectedMembers.includes(m._id)} 
                      />
                    </div>
                  </div>
                )}
                <div className="mobile-card-header">
                  <div className="mobile-avatar-wrapper">
                    <img
                      src={m.picture}
                      alt={m.name}
                      loading="lazy"
                      className="mobile-avatar"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = "flex";
                      }}
                    />
                    <div className="mobile-initials-avatar" style={{ display: m.picture ? "none" : "flex" }}>
                      {getInitials(m.name)}
                    </div>
                  </div>
                  <div className="mobile-header-text">
                    <h4>{m.name}</h4>
                    <p>{m.contact}</p>
                    <span className={`status-badge ${memStatus}`}>
                      {memStatus === "ACTIVE" ? "● Active" : "✖ Expired"}
                    </span>
                  </div>
                </div>

                <div className="mobile-card-details">
                  <div className="detail-row">
                    <span>Duration & Expiry:</span>
                    <strong>{m.duration} Days ({formatDate(m.expiryDate)})</strong>
                  </div>
                  <div className="detail-row">
                    <span>Days Remaining:</span>
                    <strong className={memStatus === "ACTIVE" ? "days-active" : "days-expired"}>{memDaysText}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Payment:</span>
                    <span className={`badge ${m.paymentStatus}`}>{m.paymentStatus}</span>
                  </div>
                  <div className="detail-row">
                    <span>Pending Amount:</span>
                    <strong className="pending-text">₹{m.pendingAmount}</strong>
                  </div>
                </div>

                <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setViewingMember(m)} className="action-btn view">👁️ Details</button>
                  <button onClick={() => { setPaymentModalMember(m); setAddPaymentAmount(""); setActionError(""); }} className="action-btn pay">💳 Pay</button>
                  <button onClick={() => openEditModal(m)} className="action-btn edit">✏️ Edit</button>
                  <button onClick={() => setDeleteConfirmMember(m)} className="action-btn delete">🗑️ Delete</button>
                </div>
              </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-bar">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="page-btn">← Previous</button>
              <span className="page-info">Page {page} of {totalPages} ({totalCount} Members)</span>
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="page-btn">Next →</button>
            </div>
          )}
        </>
      )}

      {/* Large Member Details Modal */}
      {viewingMember && (
        <div className="modal-overlay" onClick={() => setViewingMember(null)}>
          <div className="modal-card view-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Member Profile & Membership</h3>
              <button onClick={() => setViewingMember(null)} className="close-btn" aria-label="Close modal">✕</button>
            </div>

            {/* Prominent Large Profile Image Section */}
            <div className="member-profile-prominent">
              <div className="large-avatar-wrapper" onClick={() => setLightboxImage(viewingMember.picture)} title="Click to open full-screen lightbox">
                <img src={viewingMember.picture} alt={viewingMember.name} className="large-profile-img" />
                <span className="zoom-hint-badge">🔍 Click for Fullscreen</span>
              </div>
              <h2 className="profile-prominent-name">{viewingMember.name}</h2>
              <p className="profile-prominent-contact">📞 {viewingMember.contact}</p>
            </div>

            <div className="details-sections-container">
              <div className="detail-section">
                <h4>🏋️ Membership Details</h4>
                <div className="details-grid">
                    {(() => {
                      const { status: viewStatus, text: viewDaysText } = getMembershipStatus(viewingMember.expiryDate);
                      return (
                        <>
                          <div className="detail-box">
                            <label>Status</label>
                            <span className={`status-badge ${viewStatus}`}>
                              {viewStatus === "ACTIVE" ? "● Active" : "✖ Expired"}
                            </span>
                          </div>

                          <div className="detail-box">
                            <label>Days Remaining</label>
                            <strong style={{ color: (parseInt(viewDaysText) > 0) ? "#4ade80" : "#fca5a5" }}>
                              {viewDaysText}
                            </strong>
                          </div>
                        </>
                      );
                    })()}

                  <div className="detail-box">
                    <label>Start Date</label>
                    <span>{formatDate(viewingMember.startDate)}</span>
                  </div>

                  <div className="detail-box">
                    <label>Expiry Date</label>
                    <span>{formatDate(viewingMember.expiryDate)}</span>
                  </div>

                  <div className="detail-box">
                    <label>Duration</label>
                    <span>{viewingMember.duration} Days</span>
                  </div>

                  <div className="detail-box">
                    <label>Batch</label>
                    <span>{viewingMember.batch || "N/A"}</span>
                  </div>

                  <div className="detail-box">
                    <label>Time Slot</label>
                    <span>{viewingMember.timeSlot || "N/A"}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>💳 Payment & Billing Summary</h4>
                <div className="details-grid">
                  <div className="detail-box">
                    <label>Payment Status</label>
                    <span className={`badge ${viewingMember.paymentStatus}`}>{viewingMember.paymentStatus}</span>
                  </div>

                  <div className="detail-box">
                    <label>Total Membership Fee</label>
                    <span>₹{viewingMember.totalAmount}</span>
                  </div>

                  <div className="detail-box">
                    <label>Amount Paid</label>
                    <span style={{ color: "#22c55e", fontWeight: "700" }}>₹{viewingMember.paidAmount}</span>
                  </div>

                  <div className="detail-box">
                    <label>Pending Balance</label>
                    <span style={{ color: "#f59e0b", fontWeight: "700" }}>₹{viewingMember.pendingAmount}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions prominent-actions">
              <button onClick={() => { openEditModal(viewingMember); setViewingMember(null); }} className="action-btn edit">✏️ Edit Member</button>
              <button onClick={() => { setPaymentModalMember(viewingMember); setAddPaymentAmount(""); setViewingMember(null); }} className="action-btn pay">💳 Record Payment</button>
              <button onClick={() => { setDeleteConfirmMember(viewingMember); setViewingMember(null); }} className="action-btn delete">🗑️ Delete Member</button>
              <button onClick={() => setViewingMember(null)} className="cancel-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Image Lightbox */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <button onClick={() => setLightboxImage(null)} className="lightbox-close-btn" aria-label="Close fullscreen image">✕</button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="Member Full Resolution Profile" className="lightbox-img" />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmMember && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmMember(null)}>
          <div className="modal-card premium-danger-card" onClick={(e) => e.stopPropagation()}>
            <div className="danger-icon-wrapper">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <h3 className="danger-title">Delete {deleteConfirmMember.name}?</h3>
            <p className="danger-subtitle">This member will be permanently removed from MongoDB.</p>
            {actionError && <div className="alert-banner error" style={{ margin: "10px 0" }}>{actionError}</div>}
            <div className="modal-actions danger-actions">
              <button onClick={() => setDeleteConfirmMember(null)} disabled={actionLoading} className="cancel-btn danger-cancel">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmMember._id)} disabled={actionLoading} className="danger-btn premium-danger-btn">
                {actionLoading ? "Deleting..." : "Yes, Delete Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="modal-card premium-danger-card" onClick={(e) => e.stopPropagation()}>
            <div className="danger-icon-wrapper">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <h3 className="danger-title">Delete {selectedMembers.length === 1 ? "1 Member" : `${selectedMembers.length} Members`}?</h3>
            <p className="danger-subtitle">You are about to permanently delete the selected members. This action cannot be undone.</p>
            {actionError && <div className="alert-banner error" style={{ margin: "10px 0" }}>{actionError}</div>}
            <div className="danger-actions">
              <button onClick={() => setBulkDeleteConfirm(false)} disabled={actionLoading} className="danger-cancel">Cancel</button>
              <button onClick={handleBulkDelete} disabled={actionLoading} className="premium-danger-btn">
                {actionLoading ? "Deleting..." : "Delete Selected"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREMIUM Record Payment Dialog */}
      {paymentModalMember && (
        <div className="modal-overlay" onClick={() => setPaymentModalMember(null)}>
          <div className="modal-card payment-modal-premium" onClick={(e) => e.stopPropagation()}>
            <div className="payment-modal-header">
              <div className="payment-icon-wrapper">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
              </div>
              <div className="payment-header-text">
                <h3 className="payment-title">Record Payment</h3>
                <p className="payment-subtitle">{paymentModalMember.name}</p>
              </div>
              <button type="button" onClick={() => setPaymentModalMember(null)} className="redesign-close-btn" aria-label="Close modal">✕</button>
            </div>
            
            <div className="payment-summary-premium">
              <div className="pay-stat-box">
                <span className="pay-stat-label">Total Fee</span>
                <span className="pay-stat-val">₹{paymentModalMember.totalAmount}</span>
              </div>
              <div className="pay-stat-box paid-box">
                <span className="pay-stat-label">Already Paid</span>
                <span className="pay-stat-val">₹{paymentModalMember.paidAmount}</span>
              </div>
              <div className="pay-stat-box pending-box">
                <span className="pay-stat-label">Remaining</span>
                <span className="pay-stat-val">₹{paymentModalMember.pendingAmount}</span>
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="payment-form-premium">
              <div className="custom-input-group payment-input-group">
                <label>AMOUNT RECEIVED NOW (₹)</label>
                <div className="payment-input-wrapper">
                  <span className="currency-symbol">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={`Max ₹${paymentModalMember.pendingAmount}`}
                    value={addPaymentAmount}
                    onChange={(e) => setAddPaymentAmount(normalizeNumericInput(e.target.value))}
                    required
                    className="payment-input-large"
                  />
                </div>
              </div>
              <div className="modal-actions premium-modal-actions">
                <button type="button" onClick={() => setPaymentModalMember(null)} disabled={actionLoading} className="cancel-btn">Cancel</button>
                <button type="submit" disabled={actionLoading} className="premium-submit-btn">
                  {actionLoading ? "Processing..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNSAVED CHANGES CONFIRMATION MODAL */}
      {showUnsavedConfirm && (
        <div className="modal-overlay" style={{ zIndex: 100000 }} onClick={() => setShowUnsavedConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "#ffcc00", fontFamily: "'Outfit', sans-serif" }}>Discard Unsaved Changes?</h3>
            <p style={{ color: "#cbd5e1", marginTop: "8px", fontSize: "0.9rem" }}>
              You have unsaved changes in this member profile. Are you sure you want to discard them?
            </p>
            <div className="modal-actions" style={{ marginTop: "1.5rem", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowUnsavedConfirm(false)} className="cancel-btn">
                Keep Editing
              </button>
              <button type="button" onClick={forceCloseEditModal} className="danger-btn">
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REDESIGNED EDIT MEMBER MODAL */}
      {editingMember && (
        <div className="modal-overlay" onClick={attemptCloseEditModal}>
          <div className="modal-card edit-modal-redesign" onClick={(e) => e.stopPropagation()}>
            {/* Header Section with Profile Avatar & Details */}
            <div className="edit-modal-header-redesign">
              <div className="header-profile-badge">
                {editPhotoPreview || editingMember.picture ? (
                  <img src={editPhotoPreview || editingMember.picture} alt={editingMember.name} className="edit-header-avatar" />
                ) : (
                  <div className="edit-header-initials">{getInitials(editingMember.name)}</div>
                )}
              </div>
              <div className="header-text-block">
                <h2>{editingMember.name || "Edit Member"}</h2>
                <p className="header-sub-email">{editingMember.contact}</p>
                <span className="header-update-tag">Update member profile & subscription</span>
              </div>
              <button type="button" onClick={attemptCloseEditModal} className="redesign-close-btn" aria-label="Close edit modal">✕</button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="redesign-edit-form">
              <div className="sections-wrapper-grid">
                {/* SECTION 1: MEMBER INFORMATION */}
                <div className="form-card-section">
                  <h4 className="section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    MEMBER INFORMATION
                  </h4>
                  <div className="section-inputs-grid">
                    <div className="custom-input-group">
                      <label>FULL NAME</label>
                      <div className="input-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="input-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <input type="text" value={editingMember.name} onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })} required />
                      </div>
                    </div>

                    <div className="custom-input-group">
                      <label>CONTACT PHONE</label>
                      <div className="input-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="input-icon"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        <input type="text" value={editingMember.contact} onChange={(e) => setEditingMember({ ...editingMember, contact: e.target.value })} required />
                      </div>
                    </div>

                    <div className="custom-input-group">
                      <label>PROFILE PHOTO</label>
                      <div className="photo-input-control">
                        <label htmlFor="edit-photo-file" className="change-photo-btn">
                          📷 Select New Image
                        </label>
                        <input id="edit-photo-file" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
                        {editPhotoPreview && <span className="photo-selected-tag">Photo Selected ✓</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: MEMBERSHIP & EXPIRY */}
                <div className="form-card-section">
                  <h4 className="section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    MEMBERSHIP & SUBSCRIPTION
                  </h4>
                  <div className="section-inputs-grid">
                    <div className="custom-input-group">
                      <label>START DATE</label>
                      <div className="input-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="input-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <ControlledDateInput 
                          name="startDate"
                          value={editingMember.startDate || ""} 
                          onChange={(e) => setEditingMember({ ...editingMember, startDate: e.target.value })} 
                          required={true} 
                        />
                      </div>
                    </div>

                    <div className="custom-input-group">
                      <label>DURATION (DAYS)</label>
                      <div className="input-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="input-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editingMember.durationInput ?? ""}
                          onChange={(e) => setEditingMember({ ...editingMember, durationInput: normalizeNumericInput(e.target.value) })}
                          required
                        />
                        <span className="input-suffix-tag">DAYS</span>
                      </div>
                    </div>

                    <div className="custom-input-group full-width-group">
                      <label>BATCH</label>
                      <div className="preset-days-pills" style={{ marginTop: "8px" }}>
                        <button type="button" onClick={() => setEditingMember({ ...editingMember, batch: "Morning" })} className={editingMember.batch === "Morning" ? "active-preset" : ""} style={{ flex: 1 }}>Morning</button>
                        <button type="button" onClick={() => setEditingMember({ ...editingMember, batch: "Evening" })} className={editingMember.batch === "Evening" ? "active-preset" : ""} style={{ flex: 1 }}>Evening</button>
                      </div>
                    </div>

                    <div className="custom-input-group">
                      <label>TIME SLOT</label>
                      <div className="input-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="input-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <input
                          type="text"
                          value={editingMember.timeSlot || ""}
                          placeholder="e.g. 6-7"
                          onChange={(e) => setEditingMember({ ...editingMember, timeSlot: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculated Expiry Card */}
                  <div className="highlight-info-box expiry-highlight">
                    <div className="highlight-box-label">EXPECTED EXPIRY DATE</div>
                    <div className="highlight-box-value">{calculateEditExpiryPreview()}</div>
                    <div className="highlight-box-sub">Automatically calculated (Start Date + Duration)</div>
                  </div>
                </div>

                {/* SECTION 3: PAYMENT SUMMARY */}
                <div className="form-card-section">
                  <h4 className="section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                    PAYMENT & BILLING SUMMARY
                  </h4>
                  <div className="section-inputs-grid">
                    <div className="custom-input-group">
                      <label>TOTAL FEE (₹)</label>
                      <div className="input-with-icon">
                        <span className="currency-symbol-tag">₹</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editingMember.totalAmountInput ?? ""}
                          onChange={(e) => setEditingMember({ ...editingMember, totalAmountInput: normalizeNumericInput(e.target.value) })}
                          required
                        />
                      </div>
                    </div>

                    <div className="custom-input-group">
                      <label>AMOUNT PAID (₹)</label>
                      <div className="input-with-icon">
                        <span className="currency-symbol-tag">₹</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editingMember.paidAmountInput ?? ""}
                          onChange={(e) => setEditingMember({ ...editingMember, paidAmountInput: normalizeNumericInput(e.target.value) })}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Calculations Highlight */}
                  <div className="payment-summary-highlight-grid">
                    <div className="summary-stat-box">
                      <span>PENDING BALANCE</span>
                      <strong className={calculateEditPendingPreview() === 0 ? "text-green" : "text-amber"}>₹{calculateEditPendingPreview()}</strong>
                    </div>
                    <div className="summary-stat-box">
                      <span>PAYMENT STATUS</span>
                      <span className={`badge ${calculateEditPendingPreview() === 0 ? "PAID" : "PENDING"}`}>
                        {calculateEditPendingPreview() === 0 ? "PAID" : "PENDING"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: DEDICATED MEMBERSHIP STATUS */}
                <div className="form-card-section status-section-card">
                  <div className="status-flex-content">
                    {(() => {
                      const { status: previewStatus, text: previewDays } = getMembershipStatus(calculateEditExpiryPreviewDate());
                      return (
                        <>
                          <div>
                            <span className="section-title-sm">MEMBERSHIP STATUS</span>
                            <div className={`status-badge-lg ${previewStatus}`}>
                              {previewStatus === "ACTIVE" ? "● ACTIVE MEMBER" : "✖ EXPIRED MEMBER"}
                            </div>
                          </div>
                          <div className="days-tag-large">
                            {previewDays}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="redesign-modal-actions">
                <button type="button" onClick={attemptCloseEditModal} disabled={actionLoading} className="secondary-cancel-btn">
                  CANCEL
                </button>
                <button type="submit" disabled={actionLoading} className="primary-save-gold-btn">
                  {actionLoading ? "SAVING..." : "SAVE CHANGES"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllMember;
