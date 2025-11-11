# Payment Module - Stripe & Mollie Integration

A unified payment service built with TypeScript, Node.js, Express.js, and MongoDB. This module implements the adapter pattern to support multiple payment gateways (Stripe and Mollie) with a centralized interface.

## Features

- ✅ **Adapter Pattern**: Unified interface for multiple payment gateways
- ✅ **Stripe Integration**: Full support for Stripe payments
- ✅ **Mollie Integration**: Full support for Mollie payments
- ✅ **Gateway Selection**: Frontend can choose which gateway to use
- ✅ **Payment Tracking**: All payments stored in MongoDB
- ✅ **Webhook Support**: Handle payment status updates via webhooks
- ✅ **Refund Support**: Process refunds through both gateways
- ✅ **TypeScript**: Fully typed for better development experience

## Project Structure

```
payment/
├── src/
│   ├── adapters/          # Payment gateway adapters
│   │   ├── StripeAdapter.ts
│   │   └── MollieAdapter.ts
│   ├── config/            # Configuration files
│   │   └── database.ts
│   ├── controllers/       # Request handlers
│   │   ├── paymentController.ts
│   │   └── webhookController.ts
│   ├── interfaces/        # TypeScript interfaces
│   │   └── IPaymentAdapter.ts
│   ├── models/            # MongoDB models
│   │   └── Payment.ts
│   ├── routes/            # Express routes
│   │   └── paymentRoutes.ts
│   ├── services/          # Business logic
│   │   └── PaymentService.ts
│   ├── types/             # Type definitions
│   │   └── payment.types.ts
│   └── server.ts          # Express server
├── .env.example           # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:

   ```env
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/payment_db

   # Stripe Configuration
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
   STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

   # Mollie Configuration
   MOLLIE_API_KEY=test_E93bjQxc7ufsMzrxPRBVhMzAAPUwTS

   # Optional
   BASE_URL=http://localhost:3000
   ```

3. **Start MongoDB:**
   Make sure MongoDB is running on your system.

4. **Run the server:**

   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm run build
   npm start
   ```

## API Endpoints

### Create Payment Intent

This endpoint creates a payment intent/session and returns a redirect URL for the frontend to redirect the user to the payment gateway checkout page.

```http
POST /api/payment/create
Content-Type: application/json
```

**Request Body:**

For **Stripe** (requires `successUrl` and `cancelUrl`):

```json
{
  "gateway": "stripe",
  "amount": 100.0,
  "currency": "USD",
  "description": "Payment description",
  "successUrl": "http://localhost:3000/payment/success",
  "cancelUrl": "http://localhost:3000/payment/cancel",
  "orderReference": "ORDER-12345",
  "customerId": "customer@example.com",
  "metadata": {
    "orderId": "12345",
    "customerEmail": "customer@example.com"
  }
}
```

For **Mollie** (requires `returnUrl` or `successUrl`):

```json
{
  "gateway": "mollie",
  "amount": 100.0,
  "currency": "EUR",
  "description": "Payment description",
  "returnUrl": "http://localhost:3000/payment/success",
  "orderReference": "ORDER-12345",
  "customerId": "customer@example.com",
  "metadata": {
    "orderId": "12345"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "paymentId": "mongodb_payment_id",
    "gatewayPaymentId": "cs_xxx or tr_xxx",
    "status": "pending",
    "redirectUrl": "https://checkout.stripe.com/... or https://www.mollie.com/checkout/...",
    "message": "Checkout session created successfully"
  }
}
```

**Frontend Usage:**

```javascript
// Create payment intent
const response = await fetch("http://localhost:3000/api/payment/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    gateway: "stripe",
    amount: 100.0,
    currency: "USD",
    description: "Product purchase",
    successUrl: "https://yoursite.com/payment/success",
    cancelUrl: "https://yoursite.com/payment/cancel",
    orderReference: "ORDER-12345",
  }),
});

const result = await response.json();

if (result.success && result.data.redirectUrl) {
  // Redirect user to payment gateway checkout
  window.location.href = result.data.redirectUrl;

  // Save paymentId for verification after redirect
  localStorage.setItem("paymentId", result.data.paymentId);
}
```

### Get Payment Status

```http
GET /api/payment/:paymentId/status?gateway=stripe
```

**Response:**

```json
{
  "success": true,
  "data": {
    "paymentId": "payment_id",
    "gatewayPaymentId": "gateway_payment_id",
    "status": "completed",
    "amount": 100.0,
    "currency": "USD"
  }
}
```

### Get All Payments

```http
GET /api/payment/all?gateway=stripe
```

### Get Payment by ID

```http
GET /api/payment/:paymentId
```

### Verify Payment (Frontend Callback)

This endpoint is called by the frontend after redirecting from the payment gateway checkout page. It validates the payment ID, verifies the payment status with the gateway, and updates the order status in the database.

```http
GET /api/payment/:paymentId/verify?gateway=stripe
```

**Response:**

```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "mongodb_payment_id",
      "amount": 100.0,
      "currency": "USD",
      "status": "completed",
      "gateway": "stripe",
      "gatewayPaymentId": "pi_xxx",
      "description": "Payment description",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "status": {
      "paymentId": "pi_xxx",
      "gatewayPaymentId": "pi_xxx",
      "status": "completed",
      "amount": 100.0,
      "currency": "USD"
    },
    "verified": true,
    "message": "Payment verified successfully"
  }
}
```

**Frontend Usage Example:**

```javascript
// After redirect from payment gateway
const urlParams = new URLSearchParams(window.location.search);
const paymentId = urlParams.get("paymentId"); // Pass paymentId in redirect URL

// Verify payment status
const response = await fetch(
  `http://localhost:3000/api/payment/${paymentId}/verify?gateway=stripe`
);
const result = await response.json();

if (result.success && result.data.verified) {
  // Payment successful - update order status, show success message
  console.log("Payment verified:", result.data);
} else {
  // Payment failed or pending
  console.log("Payment status:", result.data.status.status);
}
```

### Process Refund

```http
POST /api/payment/:paymentId/refund
Content-Type: application/json

{
  "gateway": "stripe" | "mollie",
  "amount": 50.00,  // Optional, full refund if omitted
  "reason": "requested_by_customer"
}
```

### Webhooks

**Stripe Webhook:**

```http
POST /api/payment/webhooks/stripe
```

**Mollie Webhook:**

```http
POST /api/payment/webhooks/mollie
```

## Demo Examples

### Example 1: Create Stripe Payment

```bash
curl -X POST http://localhost:3000/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "gateway": "stripe",
    "amount": 100.00,
    "currency": "USD",
    "description": "Test payment via Stripe"
  }'
```

### Example 2: Create Mollie Payment

```bash
curl -X POST http://localhost:3000/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "gateway": "mollie",
    "amount": 50.00,
    "currency": "EUR",
    "description": "Test payment via Mollie",
    "returnUrl": "http://localhost:3000/payment/success"
  }'
```

### Example 3: Check Payment Status

```bash
curl http://localhost:3000/api/payment/PAYMENT_ID/status?gateway=stripe
```

### Example 4: Verify Payment (Frontend Callback)

```bash
curl http://localhost:3000/api/payment/PAYMENT_ID/verify?gateway=stripe
```

### Example 5: Process Refund

```bash
curl -X POST http://localhost:3000/api/payment/PAYMENT_ID/refund \
  -H "Content-Type: application/json" \
  -d '{
    "gateway": "stripe",
    "amount": 25.00,
    "reason": "requested_by_customer"
  }'
```

## Frontend Integration

The frontend can easily switch between payment gateways by simply changing the `gateway` parameter:

```javascript
// Stripe payment
const stripePayment = await fetch("http://localhost:3000/api/payment/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    gateway: "stripe",
    amount: 100.0,
    currency: "USD",
    description: "Product purchase",
  }),
});

// Mollie payment
const molliePayment = await fetch("http://localhost:3000/api/payment/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    gateway: "mollie",
    amount: 100.0,
    currency: "EUR",
    description: "Product purchase",
    returnUrl: "https://yoursite.com/payment/success",
  }),
});
```

## Testing

1. **Health Check:**

   ```bash
   curl http://localhost:3000/health
   ```

2. **Get All Payments:**
   ```bash
   curl http://localhost:3000/api/payment/all
   ```

## Environment Variables

| Variable                | Description               | Required           |
| ----------------------- | ------------------------- | ------------------ |
| `PORT`                  | Server port               | No (default: 3000) |
| `MONGODB_URI`           | MongoDB connection string | Yes                |
| `STRIPE_SECRET_KEY`     | Stripe secret key         | Yes (for Stripe)   |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret     | No                 |
| `MOLLIE_API_KEY`        | Mollie API key            | Yes (for Mollie)   |
| `BASE_URL`              | Base URL for webhooks     | No                 |

## Notes

- The adapter pattern allows easy addition of new payment gateways
- All payments are stored in MongoDB for tracking and auditing
- Webhook endpoints should be configured in your payment gateway dashboards
- For production, ensure proper error handling and logging
- Consider adding rate limiting and authentication middleware

## License

ISC
