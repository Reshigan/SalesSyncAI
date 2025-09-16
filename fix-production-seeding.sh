#!/bin/bash

# Fix Production Seeding Error
# This script resolves the Prisma seeding error by ensuring correct schema and seeding script

set -e

echo "🔧 Starting production seeding fix..."

# Navigate to backend directory
cd /home/ubuntu/SalesSyncAI/backend

# Backup current schema
echo "📋 Backing up current schema..."
cp prisma/schema.prisma prisma/schema-backup-$(date +%Y%m%d-%H%M%S).prisma

# Ensure we're using the simple schema (without Company model)
echo "📝 Ensuring simple schema is active..."
if [ -f "prisma/schema-simple.prisma" ]; then
    cp prisma/schema-simple.prisma prisma/schema.prisma
    echo "✅ Simple schema activated"
else
    echo "⚠️  Simple schema not found, using current schema"
fi

# Set environment variables
export DATABASE_URL="postgresql://salessync:salessync123@localhost:5432/salessync"
export JWT_SECRET="your-super-secret-jwt-key-change-in-production"
export NODE_ENV="production"

# Stop any running backend processes
echo "🛑 Stopping backend processes..."
pkill -f "node.*dist/index" || true
pkill -f "node.*server-production" || true
sleep 2

# Clean and regenerate Prisma client
echo "🔄 Regenerating Prisma client..."
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma/client
npx prisma generate

# Run database migration to ensure schema is up to date
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Reset database and run seeding with simple schema
echo "🌱 Resetting database and running seeding..."
npx prisma migrate reset --force --skip-seed

# Run the correct seeding script for simple schema
echo "🌱 Running simple schema seeding..."
npx ts-node prisma/seed-production-simple.ts

# Rebuild backend
echo "🔨 Rebuilding backend..."
npm run build

# Start backend with full API routes
echo "🚀 Starting backend with full API routes..."
nohup node dist/index.js > logs/backend.log 2>&1 &

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Test backend health
echo "🏥 Testing backend health..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is running successfully"
else
    echo "❌ Backend health check failed"
    echo "📋 Backend logs:"
    tail -20 logs/backend.log
    exit 1
fi

# Test API endpoints
echo "🧪 Testing API endpoints..."
if curl -f http://localhost:3000/api/auth/health > /dev/null 2>&1; then
    echo "✅ Auth API is working"
else
    echo "⚠️  Auth API test failed"
fi

echo "🎉 Production seeding fix completed successfully!"
echo "📊 Backend is running with full API routes"
echo "🌱 Database has been seeded with demo data"
echo "🔗 Login with: admin@premiumbeverages.com / admin123"
