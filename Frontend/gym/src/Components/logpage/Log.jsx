import "./Log.css";
import { useState } from "react";
import assets from "../../assets/logo.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Log = () => {
  const [LLog, SetLLog] = useState({
    id: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  const { login, authError, clearError } = useAuth();
  const navigate = useNavigate();

  const fillForm = (e) => {
    const { name, value } = e.target;
    SetLLog({ ...LLog, [name]: value });
    if (validationError) setValidationError("");
    if (authError) clearError();
  };

  const hansub = async (e) => {
    e.preventDefault();
    setValidationError("");

    if (!LLog.id.trim()) {
      setValidationError("Please enter your Gym ID");
      return;
    }

    if (!LLog.password) {
      setValidationError("Please enter your Password");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(LLog.id, LLog.password);
      setIsSubmitting(false);

      if (res.success) {
        navigate("/dashboard");
      }
    } catch (err) {
      setIsSubmitting(false);
      setValidationError("Unable to connect to the server. Please try again.");
    }
  };

  return (
    <form onSubmit={hansub}>
      <div className="logg">
        <div className="lloogg">
          <div className="logo">
            <img src={assets} alt="POWER HOUSE MULTI GYM Logo" />
          </div>

          <div className="he">
            <h1>POWER HOUSE MULTI GYM</h1>
            <p className="sub-title">Owner Portal Authentication</p>
          </div>

          {(validationError || authError) && (
            <div className="error-alert">
              <span>⚠️ {validationError || authError}</span>
            </div>
          )}

          <div className="in">
            <label htmlFor="gym-id-input" className="input-label">Enter Gym ID</label>
            <input
              id="gym-id-input"
              type="text"
              placeholder="e.g. power house multi gym"
              onChange={fillForm}
              name="id"
              value={LLog.id}
              autoComplete="username"
              disabled={isSubmitting}
            />

            <div className="password-header">
              <label htmlFor="password-input" className="input-label">Enter Password</label>
            </div>
            
            <div className="password-input-wrapper">
              <input
                id="password-input"
                type={showPassword ? "text" : "password"}
                placeholder="Enter Password"
                name="password"
                value={LLog.password}
                onChange={fillForm}
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPassword(!showPassword);
                }}
                tabIndex="-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  /* Eye-off SVG Icon (Password Visible) */
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="eye-icon">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  /* Eye SVG Icon (Password Hidden) */
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="eye-icon">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>

            <button type="submit" disabled={isSubmitting} className="submit-btn">
              {isSubmitting ? "LOGGING IN..." : "LOGIN TO DASHBOARD"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default Log;
