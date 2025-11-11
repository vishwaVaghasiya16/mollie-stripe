import mongoose, { Schema, Document } from "mongoose";

/**
 * MongoDB representation of a payment, regardless of gateway.
 * Stores both our internal state and the external gateway identifiers.
 */
export interface IPayment extends Document {
  amount: number;
  currency: string;
  gateway: "stripe" | "mollie";
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  gatewayPaymentId: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema = new Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
    },
    gateway: {
      type: String,
      required: true,
      enum: ["stripe", "mollie"],
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "processing", "completed", "failed", "cancelled"],
      default: "pending",
    },
    gatewayPaymentId: {
      type: String,
      required: true,
    },
    customerId: {
      type: String,
    },
    description: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IPayment>("Payment", PaymentSchema);
