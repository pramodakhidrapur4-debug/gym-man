const loginAttemptsMap = new Map();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const MAX_ATTEMPTS = 10; // 10 allowed attempts per window

export const loginRateLimiter = (req, res, next) => {
  const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "global";
  const now = Date.now();

  const record = loginAttemptsMap.get(clientIp) || { count: 0, resetTime: now + WINDOW_MS };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + WINDOW_MS;
  } else {
    record.count += 1;
  }

  loginAttemptsMap.set(clientIp, record);

  if (record.count > MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: "Too many login attempts. Please try again after 15 minutes.",
    });
  }

  next();
};
