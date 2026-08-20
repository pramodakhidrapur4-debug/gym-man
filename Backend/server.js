import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mong from './config/mong.js';
import adminRoutes from './Routes/adminRoutes.js';
import memberRoutes from './Routes/memberRoutes.js';
import dashboardRoutes from './Routes/dashboardRoutes.js';
import { seedDefaultOwner } from './Controller/AdminController.js';

dotenv.config();

// Ensure critical environment variables exist
const requiredEnvs = ['DB', 'JWT_SEC', 'CLOUD_ID', 'CLOUD_KEY', 'CLOUD_SEC'];
for (const env of requiredEnvs) {
  if (!process.env[env]) {
    console.error(`CRITICAL ERROR: Missing required environment variable: ${env}`);
    process.exit(1);
  }
}

const app = express();

// OWASP Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Enable JSON body parsing with 10mb payload limit for image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', limiter);

// Dynamic & Credentialed CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://gym-man-phi.vercel.app",
  "http://localhost:5174",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);

// Connect MongoDB Atlas & Seed Default Owner (Idempotent)
mong();
setTimeout(() => {
  seedDefaultOwner();
}, 2000);

// Mounted API Endpoints
app.use('/api/auth', adminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health Check Endpoint for /api
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'POWER HOUSE MULTI GYM Server running normally' });
});

// Root Health Check Endpoint for Render
app.get('/', (req, res) => {
  res.json({ success: true, message: 'POWER HOUSE GYM API is running' });
});

// Centralized Unhandled Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));