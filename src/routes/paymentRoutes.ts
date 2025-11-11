import { Router } from "express";
import { PaymentController } from "../controllers/paymentController";
import { WebhookController } from "../controllers/webhookController";

const router = Router();
const paymentController = new PaymentController();
const webhookController = new WebhookController();

/**
 * REST API surface for payments.
 * Each route simply forwards to the relevant controller method.
 */
// Payment routes
router.get(
  "/gateways",
  paymentController.getAvailableGateways.bind(paymentController)
);
router.post("/create", paymentController.createPayment.bind(paymentController));
router.get("/all", paymentController.getAllPayments.bind(paymentController));
router.get(
  "/:paymentId/verify",
  paymentController.verifyPayment.bind(paymentController)
);
router.get(
  "/:paymentId",
  paymentController.getPaymentById.bind(paymentController)
);
router.get(
  "/:paymentId/status",
  paymentController.getPaymentStatus.bind(paymentController)
);
router.post(
  "/:paymentId/refund",
  paymentController.refundPayment.bind(paymentController)
);

// Webhook routes
router.post(
  "/webhooks/stripe",
  webhookController.handleStripeWebhook.bind(webhookController)
);
router.post(
  "/webhooks/mollie",
  webhookController.handleMollieWebhook.bind(webhookController)
);

export default router;
