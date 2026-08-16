/**
 * Strict Date Formatting Utility
 * Guarantees DD MMM YYYY format (e.g. 16 Aug 2026) across all browsers.
 * Replaces unreliable toLocaleDateString() which can fall back to US formats on some devices.
 */
export const formatDisplayDate = (dateInput) => {
  if (!dateInput) return "N/A";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "N/A";
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // We use UTC methods because our backend dates and expiry calculations
    // are normalized to UTC midnight to avoid timezone shifting bugs.
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    
    return `${day} ${month} ${year}`;
  } catch {
    return "N/A";
  }
};
