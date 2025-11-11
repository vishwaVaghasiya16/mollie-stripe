#!/bin/bash

echo "🔍 Verifying Payment Module Setup..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

echo "✅ .env file exists"

# Check if Stripe key is set
if grep -q "STRIPE_SECRET_KEY=sk_" .env; then
    STRIPE_KEY=$(grep "STRIPE_SECRET_KEY=" .env | cut -d '=' -f2)
    if [ ! -z "$STRIPE_KEY" ] && [ "$STRIPE_KEY" != "sk_test_your_stripe_secret_key_here" ]; then
        echo "✅ STRIPE_SECRET_KEY is set: ${STRIPE_KEY:0:20}..."
    else
        echo "⚠️  STRIPE_SECRET_KEY is set but appears to be a placeholder"
    fi
else
    echo "❌ STRIPE_SECRET_KEY not found in .env file"
fi

# Check if Mollie key is set
if grep -q "MOLLIE_API_KEY=" .env; then
    MOLLIE_KEY=$(grep "MOLLIE_API_KEY=" .env | cut -d '=' -f2)
    if [ ! -z "$MOLLIE_KEY" ] && [ "$MOLLIE_KEY" != "test_E93bjQxc7ufsMzrxPRBVhMzAAPUwTS" ]; then
        echo "✅ MOLLIE_API_KEY is set: ${MOLLIE_KEY:0:20}..."
    else
        echo "⚠️  MOLLIE_API_KEY is set but appears to be a placeholder"
    fi
else
    echo "❌ MOLLIE_API_KEY not found in .env file"
fi

echo ""
echo "📋 Next steps:"
echo "1. Make sure MongoDB is running"
echo "2. Restart the server: npm run dev"
echo "3. Check gateway status: curl http://localhost:3000/api/payment/gateways"
echo "4. Test payment: curl -X POST http://localhost:3000/api/payment/create -H 'Content-Type: application/json' -d '{\"gateway\":\"stripe\",\"amount\":10,\"currency\":\"USD\",\"description\":\"Test\"}'"

