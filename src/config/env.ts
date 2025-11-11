/**
 * Global environment bootstrapper.
 *
 * This module MUST be imported before any other local module so each file
 * that relies on process.env variables receives the correct values. The guard
 * below prevents the .env file from being parsed and logged multiple times
 * when this module is imported from various entry points (server, controllers, etc.).
 */

import dotenv from "dotenv";
import path from "path";

declare global {
  // eslint-disable-next-line no-var
  var __ENV_LOADED: boolean | undefined;
}

if (!globalThis.__ENV_LOADED) {
  const envPath = path.resolve(process.cwd(), ".env");
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.error("❌ Error loading .env file:", result.error);
  } else {
    console.log("✅ Environment variables loaded from .env file");
    console.log("📋 Environment check:");
    console.log(
      "  STRIPE_SECRET_KEY:",
      process.env.STRIPE_SECRET_KEY
        ? `✅ Set (${process.env.STRIPE_SECRET_KEY.substring(0, 20)}...)`
        : "❌ Not set"
    );
    console.log(
      "  MOLLIE_API_KEY:",
      process.env.MOLLIE_API_KEY
        ? `✅ Set (${process.env.MOLLIE_API_KEY.substring(0, 20)}...)`
        : "❌ Not set"
    );
    console.log("");
  }

  globalThis.__ENV_LOADED = true;
}

export {};
