// Ensure env is loaded before creating service
import "../config/env";

import { Request, Response } from "express";
import { PaymentService } from "../services/PaymentService";
import { PaymentGateway } from "../types/payment.types";

const paymentService = new PaymentService();

/**
 * HTTP controller that exposes payment service capabilities to the outside world.
 * Each handler focuses on request validation, delegating the heavy lifting to the service layer.
 */
export class PaymentController {
  /**
   * Utility helper to validate and normalise the gateway value supplied by the client.
   */
  private resolveGateway(value: unknown): PaymentGateway | null {
    if (value === "stripe" || value === "mollie") {
      return value;
    }
    return null;
  }

  /**
   * Create a payment intent and return the information required by the frontend.
   */
  async createPayment(req: Request, res: Response): Promise<void> {
    try {
      const {
        gateway,
        amount,
        currency,
        description,
        customerId,
        metadata,
        returnUrl, // For Mollie
        successUrl, // For Stripe
        cancelUrl, // For Stripe
        orderReference,
      } = req.body;

      if (!gateway || !amount || !currency) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: gateway, amount, currency",
        });
        return;
      }

      const normalisedGateway = this.resolveGateway(gateway);
      if (!normalisedGateway) {
        res.status(400).json({
          success: false,
          message: 'Invalid gateway. Must be "stripe" or "mollie"',
        });
        return;
      }

      // Validate URLs for Stripe
      if (normalisedGateway === "stripe" && (!successUrl || !cancelUrl)) {
        res.status(400).json({
          success: false,
          message:
            "For Stripe gateway, both successUrl and cancelUrl are required",
        });
        return;
      }

      // Validate returnUrl for Mollie (optional but recommended)
      if (normalisedGateway === "mollie" && !returnUrl && !successUrl) {
        console.warn(
          "⚠️ No returnUrl provided for Mollie. Using default redirect URL."
        );
      }

      const paymentResponse = await paymentService.createPayment(
        normalisedGateway,
        {
          amount: parseFloat(amount),
          currency,
          description,
          customerId,
          metadata,
          returnUrl,
          successUrl,
          cancelUrl,
          orderReference,
        }
      );

      res.status(201).json({
        success: true,
        data: paymentResponse,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create payment",
      });
    }
  }

  /**
   * Return the latest status for a payment.
   */
  async getPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { gateway } = req.body;

      const normalisedGateway = this.resolveGateway(gateway);
      if (!normalisedGateway) {
        res.status(400).json({
          success: false,
          message: "Invalid or missing gateway parameter",
        });
        return;
      }

      const status = await paymentService.getPaymentStatus(
        normalisedGateway,
        paymentId
      );

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get payment status",
      });
    }
  }

  /**
   * Request a refund for a payment.
   */
  async refundPayment(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { gateway, amount, reason } = req.body;

      const normalisedGateway = gateway ? this.resolveGateway(gateway) : null;
      if (gateway && !normalisedGateway) {
        res.status(400).json({
          success: false,
          message: "Invalid gateway parameter",
        });
        return;
      }

      const refundResponse = await paymentService.refundPayment(
        {
          paymentId,
          amount: amount ? parseFloat(amount) : undefined,
          reason,
        },
        normalisedGateway || undefined
      );

      res.status(200).json({
        success: true,
        data: refundResponse,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process refund",
      });
    }
  }

  /**
   * Return paginated list of payments (currently simple full list).
   */
  async getAllPayments(req: Request, res: Response): Promise<void> {
    try {
      const { gateway } = req.query;
      const gatewayValue = Array.isArray(gateway) ? gateway[0] : gateway;
      const normalisedGateway = this.resolveGateway(gatewayValue);
      const payments = await paymentService.getAllPayments(
        normalisedGateway || undefined
      );

      res.status(200).json({
        success: true,
        data: payments,
        count: payments.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get payments",
      });
    }
  }

  /**
   * Fetch a specific payment record.
   */
  async getPaymentById(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const payment = await paymentService.getPaymentById(paymentId);

      if (!payment) {
        res.status(404).json({
          success: false,
          message: "Payment not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get payment",
      });
    }
  }

  /**
   * Report which gateways are available (based on configured adapters).
   */
  async getAvailableGateways(req: Request, res: Response): Promise<void> {
    try {
      const availableGateways = paymentService.getAvailableGateways();
      const gatewayStatus = {
        stripe: paymentService.isGatewayAvailable("stripe"),
        mollie: paymentService.isGatewayAvailable("mollie"),
      };

      res.status(200).json({
        success: true,
        data: {
          availableGateways,
          gatewayStatus,
          message:
            availableGateways.length === 0
              ? "No payment gateways are configured. Please set STRIPE_SECRET_KEY or MOLLIE_API_KEY in your .env file and restart the server."
              : `${availableGateways.length} gateway(s) available`,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get gateway status",
      });
    }
  }

  /**
   * Verify payment after frontend redirect from payment gateway.
   * This endpoint validates the payment ID and updates the order status.
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { gateway } = req.query;

      if (!paymentId) {
        res.status(400).json({
          success: false,
          message: "Payment ID is required",
        });
        return;
      }

      // Verify payment with gateway
      const verificationResult = await paymentService.verifyPayment(
        paymentId,
        this.resolveGateway(gateway) as PaymentGateway | undefined
      );

      res.status(200).json({
        success: true,
        data: {
          payment: {
            id: verificationResult.payment._id.toString(),
            amount: verificationResult.payment.amount,
            currency: verificationResult.payment.currency,
            status: verificationResult.payment.status,
            gateway: verificationResult.payment.gateway,
            gatewayPaymentId: verificationResult.payment.gatewayPaymentId,
            description: verificationResult.payment.description,
            createdAt: verificationResult.payment.createdAt,
            updatedAt: verificationResult.payment.updatedAt,
          },
          status: verificationResult.status,
          verified: verificationResult.verified,
          message: verificationResult.verified
            ? "Payment verified successfully"
            : `Payment status: ${verificationResult.status.status}`,
        },
      });
    } catch (error: any) {
      res.status(error.message?.includes("not found") ? 404 : 500).json({
        success: false,
        message: error.message || "Failed to verify payment",
      });
    }
  }
}
