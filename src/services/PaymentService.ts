import { IPaymentAdapter } from "../interfaces/IPaymentAdapter";
import { StripeAdapter } from "../adapters/StripeAdapter";
import { MollieAdapter } from "../adapters/MollieAdapter";
import Payment, { IPayment } from "../models/Payment";
import {
  PaymentGateway,
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  RefundRequest,
  RefundResponse,
} from "../types/payment.types";

/**
 * Core service that unifies multiple payment gateways behind a single API.
 *
 * The service is intentionally stateless; adapters are created once during
 * construction and the methods simply coordinate between the adapters and
 * the persistence layer.
 */
export class PaymentService {
  private adapters: Map<PaymentGateway, IPaymentAdapter>;

  constructor() {
    this.adapters = new Map();
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    const adapterConfigs: Array<{
      gateway: PaymentGateway;
      envKey: string;
      isConfigured: boolean;
      factory: () => IPaymentAdapter;
    }> = [
      {
        gateway: "stripe",
        envKey: "STRIPE_SECRET_KEY",
        isConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
        factory: () => new StripeAdapter(),
      },
      {
        gateway: "mollie",
        envKey: "MOLLIE_API_KEY",
        isConfigured: Boolean(
          process.env.MOLLIE_API_KEY &&
            process.env.MOLLIE_API_KEY.trim() !== "" &&
            process.env.MOLLIE_API_KEY !== "test_your_mollie_api_key_here"
        ),
        factory: () => new MollieAdapter(),
      },
    ];

    adapterConfigs.forEach(({ gateway, envKey, isConfigured, factory }) => {
      if (!isConfigured) {
        console.warn(
          `⚠️ ${gateway} adapter skipped: ${envKey} not found or using placeholder value`
        );
        return;
      }

      try {
        this.adapters.set(gateway, factory());
        console.log(`✅ ${gateway} adapter initialized successfully`);
      } catch (error: any) {
        console.error(
          `❌ ${gateway} adapter initialization failed:`,
          error.message
        );
      }
    });

    const availableGateways = Array.from(this.adapters.keys());
    console.log(`\n📊 Total adapters initialized: ${availableGateways.length}`);
    if (availableGateways.length > 0) {
      console.log(`   Available gateways: ${availableGateways.join(", ")}`);
    }
    console.log();
  }

  /**
   * Resolve the adapter for the requested gateway or throw an informative error.
   */
  private getAdapter(gateway: PaymentGateway): IPaymentAdapter {
    const adapter = this.adapters.get(gateway);
    if (!adapter) {
      const envVar =
        gateway === "stripe" ? "STRIPE_SECRET_KEY" : "MOLLIE_API_KEY";
      throw new Error(
        `Payment gateway "${gateway}" is not available or not configured. Please set ${envVar} in your .env file and restart the server.`
      );
    }
    return adapter;
  }

  getAvailableGateways(): PaymentGateway[] {
    return Array.from(this.adapters.keys());
  }

  isGatewayAvailable(gateway: PaymentGateway): boolean {
    return this.adapters.has(gateway);
  }

  /**
   * Create a payment using the requested gateway and persist the initial record.
   */
  async createPayment(
    gateway: PaymentGateway,
    request: PaymentRequest
  ): Promise<PaymentResponse> {
    const adapter = this.getAdapter(gateway);
    const response = await adapter.createPayment(request);

    // Save payment to database
    const payment = new Payment({
      amount: request.amount,
      currency: request.currency,
      gateway,
      status: response.status,
      gatewayPaymentId: response.gatewayPaymentId,
      customerId: request.customerId,
      description: request.description,
      metadata: {
        ...request.metadata,
        orderReference: request.orderReference,
      },
    });

    await payment.save();

    return {
      ...response,
      paymentId: payment._id.toString(),
    };
  }

  /**
   * Retrieve the latest payment status from the gateway and synchronise the record.
   */
  async getPaymentStatus(
    gateway: PaymentGateway,
    paymentId: string
  ): Promise<PaymentStatus> {
    // Get payment from database
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.gateway !== gateway) {
      throw new Error(
        `Payment gateway mismatch. Expected ${payment.gateway}, got ${gateway}`
      );
    }

    const adapter = this.getAdapter(gateway);
    const status = await adapter.getPaymentStatus(payment.gatewayPaymentId);

    // Update payment status in database
    payment.status = status.status;
    await payment.save();

    return status;
  }

  /**
   * Trigger a refund through the gateway and update the stored payment state.
   */
  async refundPayment(
    request: RefundRequest,
    gateway?: PaymentGateway
  ): Promise<RefundResponse> {
    // Get payment from database
    const payment = await Payment.findById(request.paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    const effectiveGateway = gateway ?? payment.gateway;

    if (gateway && payment.gateway !== gateway) {
      console.warn(
        `⚠️ Provided gateway "${gateway}" does not match stored value "${payment.gateway}". Using stored gateway.`
      );
    }

    const adapter = this.getAdapter(effectiveGateway);
    const refundRequest: RefundRequest = {
      paymentId: payment.gatewayPaymentId,
      amount: request.amount,
      reason: request.reason,
    };

    const response = await adapter.refundPayment(refundRequest);

    // Update payment status
    payment.status = "cancelled";
    await payment.save();

    return response;
  }

  /**
   * Process webhook payloads for a gateway and persist any status changes.
   */
  async processWebhook(
    gateway: PaymentGateway,
    payload: any,
    signature?: string
  ): Promise<PaymentStatus> {
    const adapter = this.getAdapter(gateway);

    if (signature && !adapter.verifyWebhook(payload, signature)) {
      throw new Error("Webhook signature verification failed");
    }

    const status = await adapter.processWebhook(payload);

    // Update payment in database
    const payment = await Payment.findOne({
      gatewayPaymentId: status.gatewayPaymentId,
    });

    if (payment) {
      payment.status = status.status;
      await payment.save();
    }

    return status;
  }

  /**
   * Return all payments, optionally filtered by gateway. Sorted newest first.
   */
  async getAllPayments(gateway?: PaymentGateway): Promise<IPayment[]> {
    const query = gateway ? { gateway } : {};
    return Payment.find(query).sort({ createdAt: -1 });
  }

  /**
   * Convenience helper to fetch a payment by ID.
   */
  async getPaymentById(paymentId: string): Promise<IPayment | null> {
    return Payment.findById(paymentId);
  }

  /**
   * Verify payment status with gateway and update in database
   * This is called by frontend after redirect from payment gateway
   */
  async verifyPayment(
    paymentId: string,
    gateway?: PaymentGateway
  ): Promise<{
    payment: IPayment;
    status: PaymentStatus;
    verified: boolean;
  }> {
    // Get payment from database
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    // If gateway is provided, verify it matches
    if (gateway && payment.gateway !== gateway) {
      throw new Error(
        `Payment gateway mismatch. Expected ${payment.gateway}, got ${gateway}`
      );
    }

    // Get the adapter for this payment's gateway
    const adapter = this.getAdapter(payment.gateway);

    // Verify payment status with the gateway
    const gatewayStatus = await adapter.getPaymentStatus(
      payment.gatewayPaymentId
    );

    // Update payment status in database
    payment.status = gatewayStatus.status;
    await payment.save();

    // Determine if payment was successfully verified
    const verified =
      gatewayStatus.status === "completed" ||
      gatewayStatus.status === "processing";

    return {
      payment,
      status: gatewayStatus,
      verified,
    };
  }
}
