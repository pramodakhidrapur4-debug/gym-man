const rawApiUrl = import.meta.env.VITE_API_URL || "https://gym-man-backend.onrender.com";
export const API_BASE_URL = rawApiUrl.replace(/\/$/, "");
