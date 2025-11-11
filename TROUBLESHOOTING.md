# Troubleshooting Guide

## Issue: Payment Gateway Not Available

### Symptoms

- Error: `Payment gateway "stripe" is not available or not configured`
- Server logs show: `⚠️ Stripe adapter not initialized: STRIPE_SECRET_KEY is not set in environment variables`

### Solution

1. **Verify your `.env` file exists and has the API keys:**

   ```bash
   cat .env | grep STRIPE_SECRET_KEY
   ```

2. **Restart the server:**

   ```bash
   # Stop the server (Ctrl+C) and restart
   npm run dev
   ```

3. **Check if gateways are now available:**

   ```bash
   curl http://localhost:3000/api/payment/gateways
   ```

   You should see:

   ```json
   {
     "success": true,
     "data": {
       "availableGateways": ["stripe"],
       "gatewayStatus": {
         "stripe": true,
         "mollie": false
       }
     }
   }
   ```

### Common Issues

#### 1. Environment Variables Not Loaded

- **Cause:** Server was started before `.env` file was created/updated
- **Fix:** Always restart the server after modifying `.env` file

#### 2. Invalid API Keys

- **Cause:** API keys are incorrect or have expired
- **Fix:**
  - Verify keys in your payment gateway dashboard
  - For Stripe: https://dashboard.stripe.com/apikeys
  - For Mollie: https://www.mollie.com/dashboard/developers/api-keys

#### 3. Wrong Environment Variable Name

- **Cause:** Typo in environment variable name
- **Fix:** Ensure exact names:
  - `STRIPE_SECRET_KEY` (not `STRIPE_KEY` or `STRIPE_API_KEY`)
  - `MOLLIE_API_KEY` (not `MOLLIE_KEY`)

## Check Gateway Status

Use the new endpoint to check which gateways are available:

```bash
GET http://localhost:3000/api/payment/gateways
```

This will show you:

- Which gateways are currently available
- Which gateways are configured
- Helpful messages if no gateways are configured

## Testing After Restart

1. **Check gateway status:**

   ```bash
   curl http://localhost:3000/api/payment/gateways
   ```

2. **Test payment creation:**
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

## Server Logs

After restarting, you should see:

```
✅ Stripe adapter initialized
✅ Mollie adapter initialized (if MOLLIE_API_KEY is set)
🚀 Server is running on http://localhost:3000
```

If you see warnings, check your `.env` file and restart the server.
