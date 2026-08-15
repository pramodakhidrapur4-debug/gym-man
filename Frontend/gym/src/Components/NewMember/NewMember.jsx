import React, { useState, useEffect, useRef } from "react";
import "./NewMember.css";
import { useAuth } from "../../context/AuthContext";

const NewMember = ({ onMemberAdded }) => {
  const todayStr = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contact: "",
    startDate: todayStr,
    duration: "30", // Duration in DAYS as controlled string
    totalAmount: "1000",
    paidAmount: "1000",
    picture: "",
  });

  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const { token } = useAuth();

  // Cleanup object URLs on unmount or preview changes to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [previewUrl]);

  const normalizeNumericInput = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str === "") return "";
    return str.replace(/^0+(?=\d)/, "");
  };

  // Canvas Image Compression Helper (Resizes large images to max 1200px and webp format)
  const compressImage = (file) => {
    return new Promise((resolve) => {
      if (file.size < 500 * 1024) {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
        return;
      }
      const img = new Image();
      const tempObjUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(tempObjUrl);
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/webp", 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(tempObjUrl);
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      };
      img.src = tempObjUrl;
    });
  };

  // Calculate live expected Expiry Date (Start Date + Duration in Days)
  const calculateLiveExpiry = () => {
    try {
      const start = formData.startDate ? new Date(formData.startDate) : new Date();
      if (isNaN(start.getTime())) return "N/A";
      const days = parseInt(formData.duration, 10) || 30;
      const exp = new Date(start);
      exp.setDate(exp.getDate() + days);
      return exp.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "N/A";
    }
  };

  const calculatePending = () => {
    const total = formData.totalAmount === "" ? 0 : Number(formData.totalAmount) || 0;
    const paid = formData.paidAmount === "" ? 0 : Number(formData.paidAmount) || 0;
    return Math.max(0, total - paid);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "totalAmount" || name === "paidAmount" || name === "duration") {
      const cleaned = normalizeNumericInput(value);
      setFormData({ ...formData, [name]: cleaned });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const startCamera = async () => {
    // Prevent starting if already uploading or showing preview
    if (isUploadingPhoto) return;
    
    // Revoke previous blob URL if exists
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFormData((prev) => ({ ...prev, picture: "" }));

    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setMessage({ type: "error", text: "Could not access camera. Please check permissions." });
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      
      // Mirror the image horizontally if using front camera (standard behavior)
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL("image/webp", 0.85);
      setPreviewUrl(dataUrl);
      setFormData(prev => ({ ...prev, picture: dataUrl }));
      stopCamera();
    }
  };

  const handlePresetDays = (days) => {
    let suggestedFee = 1000;
    if (days === 7) suggestedFee = 300;
    else if (days === 15) suggestedFee = 500;
    else if (days === 30) suggestedFee = 1000;
    else if (days === 45) suggestedFee = 1500;
    else if (days === 90) suggestedFee = 2700;
    else if (days === 180) suggestedFee = 5000;
    else if (days === 365) suggestedFee = 9000;

    setFormData({
      ...formData,
      duration: String(days),
      totalAmount: String(suggestedFee),
      paidAmount: String(suggestedFee),
    });
  };

  const handleImageChange = async (e) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    const file = files[0];

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setMessage({ type: "error", text: "Please select a valid image file (JPG, PNG, or WEBP)." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image is too large. Please choose an image under 5MB." });
      return;
    }

    setMessage({ type: "", text: "" });

    // Revoke previous blob URL if exists
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsUploadingPhoto(true);

    try {
      const compressedBase64 = await compressImage(file);
      setFormData((prev) => ({ ...prev, picture: compressedBase64 }));
    } catch (err) {
      console.error("Image processing error:", err);
      setMessage({ type: "error", text: "Failed to process photo. Please try another image." });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (e) => {
    if (e) e.stopPropagation();
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFormData((prev) => ({ ...prev, picture: "" }));
    const fileInput = document.getElementById("photo-upload");
    if (fileInput) fileInput.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (isUploadingPhoto) {
      setMessage({ type: "error", text: "Please wait for photo optimization to finish." });
      return;
    }

    if (!formData.name.trim() || !formData.email.trim() || !formData.contact.trim()) {
      setMessage({ type: "error", text: "Please fill in all required fields (Name, Email, Phone Contact)." });
      return;
    }

    const durationDays = parseInt(formData.duration, 10);
    if (isNaN(durationDays) || durationDays <= 0) {
      setMessage({ type: "error", text: "Duration must be a positive number of days." });
      return;
    }

    const total = formData.totalAmount === "" ? 0 : Number(formData.totalAmount);
    const paid = formData.paidAmount === "" ? 0 : Number(formData.paidAmount);

    if (isNaN(total) || total < 0) {
      setMessage({ type: "error", text: "Total fee must be a valid non-negative number." });
      return;
    }

    if (isNaN(paid) || paid < 0) {
      setMessage({ type: "error", text: "Paid amount must be a valid non-negative number." });
      return;
    }

    if (paid > total) {
      setMessage({ type: "error", text: "Paid amount cannot exceed total fee." });
      return;
    }

    setLoading(true);

    try {
      const headers = { "Content-Type": "application/json" };
      const storedToken = token || localStorage.getItem("gym_owner_token");
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
      const response = await fetch(`${API_BASE_URL}/members`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          contact: formData.contact.trim(),
          startDate: formData.startDate,
          duration: durationDays,
          totalAmount: total,
          paidAmount: paid,
          picture: formData.picture,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "Failed to register member." });
        setLoading(false);
        return;
      }

      setMessage({ type: "success", text: `Member "${data.member.name}" registered successfully!` });

      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);

      setFormData({
        name: "",
        email: "",
        contact: "",
        startDate: todayStr,
        duration: "30",
        totalAmount: "1000",
        paidAmount: "1000",
        picture: "",
      });

      const fileInput = document.getElementById("photo-upload");
      if (fileInput) fileInput.value = "";

      if (onMemberAdded) onMemberAdded();
    } catch (err) {
      console.error("Create member error:", err);
      setMessage({ type: "error", text: "Network failure while saving member." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="new-member-container">
      <h2 className="new-member-heading">Register New Member</h2>

      {message.text && (
        <div className={`new-member-alert ${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="new-member-form">
        <div className="form-grid">
          <div className="form-group">
            <label>Full Name *</label>
            <input
              type="text"
              name="name"
              placeholder="e.g. Rahul Patil"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Email Address *</label>
            <input
              type="email"
              name="email"
              placeholder="e.g. rahul@example.com"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Phone Contact *</label>
            <input
              type="text"
              name="contact"
              placeholder="e.g. 9876543210"
              value={formData.contact}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Start Date *</label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group full-width-group">
            <label>Duration (in Days) *</label>
            <div className="days-input-wrapper">
              <input
                type="text"
                inputMode="numeric"
                name="duration"
                placeholder="e.g. 30"
                value={formData.duration}
                onChange={handleInputChange}
                required
              />
              <span className="days-suffix">Days</span>
            </div>
            <div className="preset-days-pills">
              <button type="button" onClick={() => handlePresetDays(7)} className={formData.duration == 7 ? "active-preset" : ""}>7 Days</button>
              <button type="button" onClick={() => handlePresetDays(15)} className={formData.duration == 15 ? "active-preset" : ""}>15 Days</button>
              <button type="button" onClick={() => handlePresetDays(30)} className={formData.duration == 30 ? "active-preset" : ""}>30 Days</button>
              <button type="button" onClick={() => handlePresetDays(45)} className={formData.duration == 45 ? "active-preset" : ""}>45 Days</button>
              <button type="button" onClick={() => handlePresetDays(90)} className={formData.duration == 90 ? "active-preset" : ""}>90 Days</button>
              <button type="button" onClick={() => handlePresetDays(365)} className={formData.duration == 365 ? "active-preset" : ""}>365 Days</button>
            </div>
          </div>

          <div className="form-group">
            <label>Total Fee (₹) *</label>
            <input
              type="text"
              inputMode="numeric"
              name="totalAmount"
              placeholder="1000"
              value={formData.totalAmount}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Amount Paid (₹) *</label>
            <input
              type="text"
              inputMode="numeric"
              name="paidAmount"
              placeholder="1000"
              value={formData.paidAmount}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        {/* Calculated Summary Box */}
        <div className="calculated-summary">
          <span>Calculated Expiry: <strong>{calculateLiveExpiry()}</strong></span>
          <span>Pending Balance: <strong>₹{calculatePending()}</strong></span>
          <span>Payment Status: <strong className={calculatePending() === 0 ? "status-paid" : "status-pending"}>
            {calculatePending() === 0 ? "PAID" : "PENDING"}
          </strong></span>
        </div>

        {/* PREMIUM GYM PHOTO UPLOAD COMPONENT */}
        <div className="image-upload-section">
          <label>Member Profile Photo</label>
          
          {!isCameraOpen ? (
            <div
              className={`premium-photo-card ${previewUrl ? "has-photo" : ""} ${isDragging ? "dragging" : ""}`}
              onClick={(e) => {
                if (e.target.closest('.photo-action-btn') || e.target.closest('.camera-btn')) return;
                document.getElementById("photo-upload")?.click();
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleImageChange({ target: { files: e.dataTransfer.files } });
                }
              }}
            >
              <input
                id="photo-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />

              {isUploadingPhoto ? (
                <div className="photo-uploading-overlay">
                  <div className="photo-spinner"></div>
                  <span>Processing & Optimizing Photo...</span>
                </div>
              ) : previewUrl ? (
                <div className="photo-preview-box">
                  <img src={previewUrl} alt="Member Photo Preview" className="photo-preview-img" />
                  <div className="photo-actions-overlay" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="photo-action-btn change" onClick={() => document.getElementById("photo-upload")?.click()}>
                      📁 Change
                    </button>
                    <button type="button" className="photo-action-btn camera" onClick={startCamera}>
                      📸 Retake
                    </button>
                    <button type="button" className="photo-action-btn remove" onClick={handleRemovePhoto}>
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="photo-placeholder-box">
                  <div className="photo-icon-circle">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  </div>
                  <span className="photo-upload-title">Add Member Photo</span>
                  <span className="photo-upload-sub">Drag & drop image, click to browse, or use camera</span>
                  <div className="camera-btn-container" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="camera-btn" onClick={startCamera}>
                      📸 Take Photo with Camera
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="camera-container">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="live-video-feed"
                onLoadedMetadata={() => videoRef.current.play()}
              ></video>
              <div className="camera-overlay-actions">
                <button type="button" className="cancel-camera-btn" onClick={stopCamera}>Cancel</button>
                <button type="button" className="capture-camera-btn" onClick={capturePhoto}>
                  <div className="capture-inner-circle"></div>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading || isUploadingPhoto} className="submit-member-btn">
            {loading ? "Registering member..." : isUploadingPhoto ? "Processing photo..." : "✨ Complete Registration"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewMember;