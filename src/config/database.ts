/**
 * Database bootstrap helper.
 *
 * Centralised connection logic keeps the rest of the application lean and makes
 * it easier to swap out the connection configuration in one place.
 */

import mongoose from "mongoose";

/**
 * Connect to MongoDB using the connection string supplied via `MONGODB_URI`.
 * Falls back to a local database to simplify development.
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/payment_db";

    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};
