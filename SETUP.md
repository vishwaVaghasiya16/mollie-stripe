# Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/payment_db

# Stripe Configuration
# Get your keys from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_51RnDNTGhoBwNfpLsVnEgAwUZVIMkXIxUmRGS5PjNPD228Pv78nudkm3pwFSYrQSnvp8Rpw4D95JJ0eFwptsZXR4H00nXG8K1pg
STRIPE_PUBLISHABLE_KEY=pk_test_51RnDNTGhoBwNfpLsIZ8zAkjXIpIuTqlU0QbtTfs6bgo5u63WvEzbn3KeK7pDZzK7qBGuo5XN58jxEOgyQTFyuWrQ00KRIUdMew
STRIPE_WEBHOOK_SECRET=whsec_MONsrH2dSzNMx4Gdk1TrJWF75zNuik68

# Mollie Configuration
# Get your key from: https://www.mollie.com/dashboard/developers/api-keys
MOLLIE_API_KEY=test_E93bjQxc7ufsMzrxPRBVhMzAAPUwTS

# Optional
BASE_URL=http://localhost:3000
```

### 3. Start MongoDB

Make sure MongoDB is running:

```bash
# macOS (using Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. Run the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

### 5. Test the Setup

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "ok",
#   "message": "Payment service is running",
#   "timestamp": "2024-01-01T00:00:00.000Z"
# }
```

## Getting API Keys

### Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Developers** > **API keys**
3. Copy your **Secret key** (starts with `sk_test_` for test mode)
4. Copy your **Publishable key** (starts with `pk_test_` for test mode)
5. For webhooks, go to **Developers** > **Webhooks** and create an endpoint

### Mollie

1. Go to [Mollie Dashboard](https://www.mollie.com/dashboard/)
2. Navigate to **Developers** > **API keys**
3. Copy your **Test API key** (starts with `test_`)
4. For production, use your **Live API key** (starts with `live_`)

## Testing Payments

### Test with Stripe

```bash
curl -X POST http://localhost:3000/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "gateway": "stripe",
    "amount": 10.00,
    "currency": "USD",
    "description": "Test payment"
  }'
```

### Test with Mollie

```bash
curl -X POST http://localhost:3000/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "gateway": "mollie",
    "amount": 10.00,
    "currency": "EUR",
    "description": "Test payment",
    "returnUrl": "http://localhost:3000/payment/success"
  }'
```

## Troubleshooting

### MongoDB Connection Error

- Ensure MongoDB is running
- Check your `MONGODB_URI` in `.env`
- Default connection: `mongodb://localhost:27017/payment_db`

### Payment Gateway Errors

- Verify your API keys are correct in `.env`
- For Stripe: Ensure you're using test keys (starts with `sk_test_`)
- For Mollie: Ensure you're using test keys (starts with `test_`)

### TypeScript Errors

- Run `npm install` to install all dependencies
- Ensure `@types/node` is installed: `npm install --save-dev @types/node`

## Next Steps

1. Review the `README.md` for API documentation
2. Check `demo.http` for example requests
3. Configure webhooks in your payment gateway dashboards
4. Integrate with your frontend application
