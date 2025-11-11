/**
 * Shared type definitions consumed by adapters, services, and controllers.
 */
export type PaymentGateway = "stripe" | "mollie";

export interface PaymentRequest {
  amount: number;
  currency: string;
  description?: string;
  customerId?: string;
  metadata?: Record<string, any>;
  returnUrl?: string; // For Mollie - redirect URL after payment
  successUrl?: string; // For Stripe - success redirect URL
  cancelUrl?: string; // For Stripe - cancel redirect URL
  webhookUrl?: string;
  orderReference?: string; // Order ID or reference number
}

export interface PaymentResponse {
  success: boolean;
  paymentId: string;
  gatewayPaymentId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  redirectUrl?: string;
  message?: string;
}

export interface PaymentStatus {
  paymentId: string;
  gatewayPaymentId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
}

export interface RefundResponse {
  success: boolean;
  refundId: string;
  amount: number;
  status: string;
  message?: string;
}
