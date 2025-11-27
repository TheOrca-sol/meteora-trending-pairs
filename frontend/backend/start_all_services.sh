#!/bin/bash
# Start all services for liquidity automation

echo "🚀 Starting all services..."

# Check if services directory exists
if [ ! -d "../services/meteora-service" ]; then
    echo "❌ Meteora service directory not found"
    exit 1
fi

# Start Meteora microservice in background
echo "📦 Starting Meteora microservice..."
cd ../services/meteora-service
if [ ! -d "node_modules" ]; then
    echo "   Installing Node.js dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env not found in meteora-service, copying from example..."
    cp .env.example .env
    echo "   Please edit services/meteora-service/.env and add DEGEN_WALLET_PRIVATE_KEY"
fi

# Start service in background
npm start > ../../logs/meteora-service.log 2>&1 &
METEORA_PID=$!
echo "   ✅ Meteora service started (PID: $METEORA_PID)"
echo "   📋 Logs: logs/meteora-service.log"

# Wait a bit for service to start
sleep 3

# Check if service is healthy
echo "🔍 Checking Meteora service health..."
HEALTH=$(curl -s http://localhost:3002/health)
if [ $? -eq 0 ]; then
    echo "   ✅ Meteora service is healthy"
    echo "   $HEALTH"
else
    echo "   ❌ Meteora service health check failed"
    echo "   Check logs/meteora-service.log for errors"
fi

# Go back to backend directory
cd ../../backend

# Start Flask backend
echo ""
echo "🐍 Starting Python backend..."
source venv/bin/activate
python app.py

# Cleanup on exit
trap "kill $METEORA_PID 2>/dev/null" EXIT
