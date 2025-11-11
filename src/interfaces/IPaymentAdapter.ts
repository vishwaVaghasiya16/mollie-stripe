import {
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  RefundRequest,
  RefundResponse,
} from "../types/payment.types";

/**
 * Contract that every payment adapter must fulfil so the service layer can
 * operate without caring which gateway is being used.
 */
export interface IPaymentAdapter {
  /**
   * Create a payment
   */
  createPayment(request: PaymentRequest): Promise<PaymentResponse>;

  /**
   * Get payment status
   */
  getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus>;

  /**
   * Process refund
   */
  refundPayment(request: RefundRequest): Promise<RefundResponse>;

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: any, signature: string): boolean;

  /**
   * Process webhook event
   */
  processWebhook(event: any): Promise<PaymentStatus>;
}
