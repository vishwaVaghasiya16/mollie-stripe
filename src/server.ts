/**
 * HTTP entry point for the payment service.
 *
 * The server is intentionally lightweight – it wires Express middleware,
 * mounts the payment routes, and kicks off the database connection.
 */

// IMPORTANT: Load environment variables FIRST before any other imports.
import "./config/env";

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { connectDatabase } from "./config/database";
import paymentRoutes from "./routes/paymentRoutes";

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Stripe webhooks require the raw body for signature verification.
app.use(
  "/api/payment/webhooks/stripe",
  express.raw({ type: "application/json" })
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Payment service is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/payment", paymentRoutes);

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
);

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📝 Health check: http://localhost:${PORT}/health`);
      console.log(`💳 Payment API: http://localhost:${PORT}/api/payment`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
