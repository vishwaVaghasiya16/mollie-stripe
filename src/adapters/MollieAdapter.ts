import {
  createMollieClient,
  Payment,
  PaymentStatus as MolliePaymentStatus,
} from "@mollie/api-client";
import { IPaymentAdapter } from "../interfaces/IPaymentAdapter";
import {
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  RefundRequest,
  RefundResponse,
} from "../types/payment.types";

/**
 * Mollie implementation of the payment adapter contract.
 *
 * Shields the rest of the codebase from Mollie-specific SDK details so we can
 * switch gateways or add new ones with minimal impact.
 */
export class MollieAdapter implements IPaymentAdapter {
  private mollieClient: ReturnType<typeof createMollieClient>;

  constructor() {
    const apiKey = process.env.MOLLIE_API_KEY;

    // Check if key exists and is not empty/whitespace
    if (
      !apiKey ||
      apiKey.trim() === "" ||
      apiKey === "test_your_mollie_api_key_here"
    ) {
      throw new Error(
        "MOLLIE_API_KEY is not set in environment variables. " +
          "Please check your .env file and ensure MOLLIE_API_KEY is set correctly."
      );
    }

    // Validate key format (should start with test_ or live_)
    if (!apiKey.startsWith("test_") && !apiKey.startsWith("live_")) {
      console.warn(
        "⚠️ Warning: MOLLIE_API_KEY doesn't match expected format (should start with test_ or live_)"
      );
    }

    try {
      this.mollieClient = createMollieClient({ apiKey: apiKey.trim() });
    } catch (error: any) {
      throw new Error(`Failed to initialize Mollie client: ${error.message}`);
    }
  }

  /**
   * Create a payment at Mollie and return the checkout URL so the caller can redirect the user.
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Use returnUrl or successUrl for redirect
      const redirectUrl =
        request.returnUrl ||
        request.successUrl ||
        "http://localhost:3000/payment/success";

      // Add paymentId to redirect URL for verification
      const redirectUrlWithParams = `${redirectUrl}?paymentId={PAYMENT_ID}`;

      // Build webhook URL - only include if it's a public URL (not localhost)
      const baseUrl =
        request.webhookUrl || process.env.BASE_URL || process.env.WEBHOOK_URL;
      let webhookUrl: string | undefined;

      if (
        baseUrl &&
        !baseUrl.includes("localhost") &&
        !baseUrl.includes("127.0.0.1")
      ) {
        // Public URL - Mollie can reach it
        webhookUrl = `${baseUrl}/api/payment/webhooks/mollie`;
      } else if (process.env.NODE_ENV === "production") {
        // Production but no valid webhook URL - this is an error
        throw new Error(
          "Webhook URL must be a public URL in production. Please set BASE_URL or WEBHOOK_URL environment variable."
        );
      }
      // For localhost/development, we skip webhook URL (Mollie can't reach localhost)
      // Payment status will be checked via the verify endpoint instead

      const paymentParams: any = {
        amount: {
          currency: request.currency.toUpperCase(),
          value: request.amount.toFixed(2),
        },
        description: request.description || "Payment",
        redirectUrl: redirectUrlWithParams,
        metadata: {
          ...request.metadata,
          customerId: request.customerId || "",
          orderReference: request.orderReference || "",
        },
      };

      // Only add webhookUrl if it's a valid public URL
      if (webhookUrl) {
        paymentParams.webhookUrl = webhookUrl;
      }

      const payment = await this.mollieClient.payments.create(paymentParams);

      // Get checkout URL and replace placeholder with actual payment ID
      const checkoutUrl = payment.getCheckoutUrl();
      const finalRedirectUrl = checkoutUrl
        ? checkoutUrl.replace("{PAYMENT_ID}", payment.id)
        : undefined;

      return {
        success: true,
        paymentId: payment.id,
        gatewayPaymentId: payment.id,
        status: this.mapMollieStatus(payment.status),
        redirectUrl: finalRedirectUrl,
        message: "Payment created successfully",
      };
    } catch (error: any) {
      throw new Error(`Mollie payment creation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve the latest payment status from Mollie.
   */
  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus> {
    try {
      const payment = await this.mollieClient.payments.get(gatewayPaymentId);

      return {
        paymentId: payment.id,
        gatewayPaymentId: payment.id,
        status: this.mapMollieStatus(payment.status),
        amount: parseFloat(payment.amount.value),
        currency: payment.amount.currency,
        metadata: payment.metadata as Record<string, any>,
      };
    } catch (error: any) {
      throw new Error(`Failed to get Mollie payment status: ${error.message}`);
    }
  }

  /**
   * Request a refund via Mollie.
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    try {
      // First get the payment
      const payment = await this.mollieClient.payments.get(request.paymentId);

      if (!payment.amountRemaining) {
        throw new Error("No amount available for refund");
      }

      const refundParams: any = {
        paymentId: request.paymentId,
      };

      if (request.amount) {
        refundParams.amount = {
          currency: payment.amount.currency,
          value: request.amount.toFixed(2),
        };
      }

      const refund = await this.mollieClient.paymentRefunds.create(
        refundParams
      );

      return {
        success: true,
        refundId: refund.id,
        amount: parseFloat(refund.amount.value),
        status: refund.status,
        message: "Refund processed successfully",
      };
    } catch (error: any) {
      throw new Error(`Mollie refund failed: ${error.message}`);
    }
  }

  /**
   * Mollie uses a fetch-back approach for webhooks, therefore verification is a no-op.
   */
  verifyWebhook(payload: any, signature: string): boolean {
    // Mollie doesn't use signature verification in the same way as Stripe
    // Instead, you should verify the webhook by fetching the payment from Mollie
    // For simplicity, we'll return true here, but in production you should verify
    return true;
  }

  /**
   * Handle webhook notifications by querying Mollie for the authoritative status.
   */
  async processWebhook(event: any): Promise<PaymentStatus> {
    try {
      const paymentId = event.id;
      const payment = await this.mollieClient.payments.get(paymentId);

      return {
        paymentId: payment.id,
        gatewayPaymentId: payment.id,
        status: this.mapMollieStatus(payment.status),
        amount: parseFloat(payment.amount.value),
        currency: payment.amount.currency,
        metadata: payment.metadata as Record<string, any>,
      };
    } catch (error: any) {
      throw new Error(`Failed to process Mollie webhook: ${error.message}`);
    }
  }

  /**
   * Convert Mollie payment statuses into our shared enum.
   */
  private mapMollieStatus(
    status: MolliePaymentStatus
  ): PaymentStatus["status"] {
    const statusMap: Record<string, PaymentStatus["status"]> = {
      open: "pending",
      canceled: "cancelled",
      pending: "processing",
      expired: "failed",
      failed: "failed",
      paid: "completed",
    };

    return statusMap[status] || "pending";
  }
}
