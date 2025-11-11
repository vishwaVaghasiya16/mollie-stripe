// Ensure env is loaded before creating service
import "../config/env";

import { Request, Response } from "express";
import { PaymentService } from "../services/PaymentService";
import { PaymentGateway } from "../types/payment.types";

const paymentService = new PaymentService();

/**
 * Handles webhook callbacks from supported payment gateways.
 *
 * The controller keeps the code focused on request validation while the service
 * performs the actual business logic.
 */
export class WebhookController {
  /**
   * Stripe webhook handler.
   * Expects the Stripe signature header to verify authenticity.
   */
  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers["stripe-signature"] as string;
      const payload = req.body;

      const status = await paymentService.processWebhook(
        "stripe",
        payload,
        signature
      );

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Webhook processing failed",
      });
    }
  }

  /**
   * Mollie webhook handler.
   * Mollie sends the payment ID and expects us to fetch the status directly.
   */
  async handleMollieWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.body;
      const payload = { id };

      const status = await paymentService.processWebhook("mollie", payload);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      console.error("Mollie webhook error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Webhook processing failed",
      });
    }
  }
}
