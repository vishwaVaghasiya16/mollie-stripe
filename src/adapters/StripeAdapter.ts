import Stripe from "stripe";
import { IPaymentAdapter } from "../interfaces/IPaymentAdapter";
import {
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  RefundRequest,
  RefundResponse,
} from "../types/payment.types";

/**
 * Stripe implementation of the payment adapter contract.
 *
 * Responsible solely for translating the shared adapter interface into Stripe's
 * SDK calls so higher layers never need to worry about gateway-specific logic.
 */
export class StripeAdapter implements IPaymentAdapter {
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    // Check if key exists and is not empty/whitespace
    if (!secretKey || secretKey.trim() === "") {
      throw new Error(
        "STRIPE_SECRET_KEY is not set in environment variables. " +
          "Please check your .env file and ensure STRIPE_SECRET_KEY is set correctly."
      );
    }

    // Validate key format (should start with sk_test_ or sk_live_)
    if (
      !secretKey.startsWith("sk_test_") &&
      !secretKey.startsWith("sk_live_")
    ) {
      console.warn(
        "⚠️ Warning: STRIPE_SECRET_KEY doesn't match expected format (should start with sk_test_ or sk_live_)"
      );
    }

    try {
      this.stripe = new Stripe(secretKey.trim(), {
        apiVersion: "2023-08-16",
      });
    } catch (error: any) {
      throw new Error(`Failed to initialize Stripe client: ${error.message}`);
    }
  }

  /**
   * Align Stripe-specific statuses with our shared enum.
   */
  private mapStripeStatusToInternalStatus(
    stripeStatus: string
  ): PaymentStatus["status"] {
    const statusMap: Record<string, PaymentStatus["status"]> = {
      requires_payment_method: "pending",
      requires_confirmation: "pending",
      requires_action: "processing",
      processing: "processing",
      requires_capture: "processing",
      canceled: "cancelled",
      cancelled: "cancelled",
      succeeded: "completed",
      payment_failed: "failed",
    };

    return statusMap[stripeStatus] || "pending";
  }

  /**
   * Create either a Checkout Session (redirect flow) or Payment Intent (API flow)
   * depending on the payload supplied by the caller.
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // If successUrl and cancelUrl are provided, use Checkout Session (for redirect flow)
      if (request.successUrl && request.cancelUrl) {
        const session = await this.stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: request.currency.toLowerCase(),
                product_data: {
                  name: request.description || "Payment",
                  description: request.description,
                },
                unit_amount: Math.round(request.amount * 100), // Convert to cents
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${request.successUrl}?paymentId={CHECKOUT_SESSION_ID}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: request.cancelUrl,
          metadata: {
            ...request.metadata,
            customerId: request.customerId || "",
            orderReference: request.orderReference || "",
          },
          customer_email: request.customerId, // Optional: if customerId is an email
        });

        return {
          success: true,
          paymentId: session.id,
          gatewayPaymentId: session.id,
          status: "pending",
          redirectUrl: session.url || undefined,
          message: "Checkout session created successfully",
        };
      } else {
        // Fallback to Payment Intent (for custom checkout flows)
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(request.amount * 100), // Convert to cents
          currency: request.currency.toLowerCase(),
          description: request.description,
          metadata: {
            ...request.metadata,
            customerId: request.customerId || "",
            orderReference: request.orderReference || "",
          },
          automatic_payment_methods: {
            enabled: true,
          },
        });

        // Map Stripe status to our internal status
        const mappedStatus = this.mapStripeStatusToInternalStatus(
          paymentIntent.status
        );

        return {
          success: true,
          paymentId: paymentIntent.id,
          gatewayPaymentId: paymentIntent.id,
          status: mappedStatus,
          redirectUrl: undefined,
          message: "Payment intent created successfully",
        };
      }
    } catch (error: any) {
      throw new Error(`Stripe payment creation failed: ${error.message}`);
    }
  }

  /**
   * Fetch the latest payment status from Stripe.
   * Handles both Checkout Session IDs (cs_...) and Payment Intent IDs (pi_...).
   */
  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus> {
    try {
      // Try to retrieve as Checkout Session first (starts with cs_)
      if (gatewayPaymentId.startsWith("cs_")) {
        const session = await this.stripe.checkout.sessions.retrieve(
          gatewayPaymentId,
          { expand: ["payment_intent"] }
        );

        // Get payment intent from session
        const paymentIntent =
          session.payment_intent as Stripe.PaymentIntent | null;

        if (paymentIntent) {
          const mappedStatus = this.mapStripeStatusToInternalStatus(
            paymentIntent.status
          );

          return {
            paymentId: session.id,
            gatewayPaymentId: session.id,
            status: mappedStatus,
            amount: (session.amount_total || 0) / 100, // Convert from cents
            currency: (session.currency || "usd").toUpperCase(),
            metadata: session.metadata || {},
          };
        } else {
          // Session exists but no payment intent yet (still pending)
          return {
            paymentId: session.id,
            gatewayPaymentId: session.id,
            status: "pending",
            amount: (session.amount_total || 0) / 100,
            currency: (session.currency || "usd").toUpperCase(),
            metadata: session.metadata || {},
          };
        }
      } else {
        // Fallback to Payment Intent (starts with pi_)
        const paymentIntent = await this.stripe.paymentIntents.retrieve(
          gatewayPaymentId
        );

        const mappedStatus = this.mapStripeStatusToInternalStatus(
          paymentIntent.status
        );

        return {
          paymentId: paymentIntent.id,
          gatewayPaymentId: paymentIntent.id,
          status: mappedStatus,
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency.toUpperCase(),
          metadata: paymentIntent.metadata,
        };
      }
    } catch (error: any) {
      throw new Error(`Failed to get Stripe payment status: ${error.message}`);
    }
  }

  /**
   * Initiate a refund for the supplied payment.
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    try {
      let paymentIntent: Stripe.PaymentIntent;

      // Check if it's a Checkout Session ID (starts with cs_)
      if (request.paymentId.startsWith("cs_")) {
        // Retrieve the Checkout Session first
        const session = await this.stripe.checkout.sessions.retrieve(
          request.paymentId,
          { expand: ["payment_intent"] }
        );

        // Get the Payment Intent from the session
        if (!session.payment_intent) {
          throw new Error(
            "No payment intent found for this checkout session. Payment may not be completed yet."
          );
        }

        // If it's already expanded, use it directly; otherwise retrieve it
        if (typeof session.payment_intent === "string") {
          paymentIntent = await this.stripe.paymentIntents.retrieve(
            session.payment_intent
          );
        } else {
          paymentIntent = session.payment_intent as Stripe.PaymentIntent;
        }
      } else {
        // It's a Payment Intent ID (starts with pi_)
        paymentIntent = await this.stripe.paymentIntents.retrieve(
          request.paymentId
        );
      }

      // Check if payment intent has a charge
      if (!paymentIntent.latest_charge) {
        throw new Error(
          "No charge found for this payment. Payment may not be completed yet."
        );
      }

      // Create refund parameters
      const refundParams: Stripe.RefundCreateParams = {
        charge: paymentIntent.latest_charge as string,
        reason: request.reason as Stripe.RefundCreateParams.Reason,
      };

      // If partial refund amount is specified
      if (request.amount) {
        refundParams.amount = Math.round(request.amount * 100);
      }

      // Process the refund
      const refund = await this.stripe.refunds.create(refundParams);

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status || "pending",
        message: "Refund processed successfully",
      };
    } catch (error: any) {
      throw new Error(`Stripe refund failed: ${error.message}`);
    }
  }

  /**
   * Verify webhook payloads using the configured signing secret.
   */
  verifyWebhook(payload: any, signature: string): boolean {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.warn("STRIPE_WEBHOOK_SECRET not set, skipping verification");
        return true;
      }

      this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return true;
    } catch (error) {
      console.error("Webhook verification failed:", error);
      return false;
    }
  }

  /**
   * Interpret Stripe webhook events and map them to our shared status enum.
   */
  async processWebhook(event: any): Promise<PaymentStatus> {
    try {
      const paymentIntent = event.data.object;

      // Map webhook event type to payment intent status, then to internal status
      let stripeStatus = paymentIntent.status;

      // Handle specific webhook events that might have different statuses
      const eventStatusMap: Record<string, string> = {
        "payment_intent.succeeded": "succeeded",
        "payment_intent.payment_failed": "payment_failed",
        "payment_intent.canceled": "canceled",
        "payment_intent.processing": "processing",
      };

      if (eventStatusMap[event.type]) {
        stripeStatus = eventStatusMap[event.type];
      }

      // Use the same mapping method for consistency
      const mappedStatus = this.mapStripeStatusToInternalStatus(stripeStatus);

      return {
        paymentId: paymentIntent.id,
        gatewayPaymentId: paymentIntent.id,
        status: mappedStatus,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        metadata: paymentIntent.metadata,
      };
    } catch (error: any) {
      throw new Error(`Failed to process Stripe webhook: ${error.message}`);
    }
  }
}
