#!/bin/bash

# Script to restart the backend with the full version including reporting routes

echo "🔄 Restarting SalesSync Backend with Full API Routes..."

# Navigate to backend directory
cd /home/ubuntu/SalesSyncAI/backend

# Stop any existing PM2 processes
pm2 stop all
pm2 delete all

# Rebuild the backend to ensure latest code
echo "📦 Building backend..."
npm run build

# Verify the reporting routes are compiled
if [ -f "dist/api/reporting/routes.js" ]; then
    echo "✅ Reporting routes found in compiled code"
else
    echo "❌ Reporting routes missing from compiled code"
    exit 1
fi

# Start the backend using the main index.js (which includes all routes)
echo "🚀 Starting backend with full API routes..."
pm2 start dist/index.js --name "salessync-backend" --env production

# Set environment variables for PM2
pm2 set salessync-backend:DATABASE_URL "postgresql://salessync:salessync123@localhost:5432/salessync"
pm2 set salessync-backend:NODE_ENV "production"
pm2 set salessync-backend:JWT_SECRET "your-super-secret-jwt-key-change-in-production"

# Restart with new environment
pm2 restart salessync-backend

# Show status
pm2 status

echo "✅ Backend restarted with full API routes"
echo "🔍 Testing API endpoints..."

# Wait a moment for the server to start
sleep 3

# Test health endpoint
echo "Testing health endpoint..."
curl -s http://localhost:3000/health | jq .

# Test auth endpoint
echo "Testing auth endpoint..."
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@premiumbeverages.com","password":"admin123"}' | jq .success

# Test reporting endpoint (should work now)
echo "Testing reporting endpoint..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@premiumbeverages.com","password":"admin123"}' | jq -r .data.token)

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/reporting/dashboard | jq .

echo "🎉 Backend restart complete!"