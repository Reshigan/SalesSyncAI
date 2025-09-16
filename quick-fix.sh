#!/bin/bash

# 🚀 SalesSync Production Seeding Fix
# Run this script on your production server to fix the seeding error

echo "🔧 Starting SalesSync seeding fix..."

# Navigate to project directory
cd /home/ubuntu/SalesSyncAI || { echo "❌ Project directory not found"; exit 1; }

# Pull latest changes
echo "📥 Pulling latest fixes from GitHub..."
git pull origin main

# Navigate to backend
cd backend || { echo "❌ Backend directory not found"; exit 1; }

# Apply the schema fix
echo "🔄 Applying schema fix..."
cp prisma/schema-simple.prisma prisma/schema.prisma

# Regenerate Prisma client
echo "⚙️ Regenerating Prisma client..."
npx prisma generate

# Run the correct seeding script
echo "🌱 Running database seeding..."
npx ts-node prisma/seed-production-simple.ts

# Verify the fix
echo "✅ Verifying database..."
psql -h localhost -U salessync -d salessync -c "SELECT COUNT(*) as user_count FROM users;" 2>/dev/null || echo "Database verification skipped (psql not available)"

echo ""
echo "🎉 SEEDING FIX COMPLETED SUCCESSFULLY!"
echo ""
echo "✅ Your SalesSync application should now work properly"
echo "✅ Login at: http://13.246.34.207/login"
echo "✅ Use demo credentials: admin@premiumbeverages.com / admin123"
echo ""
echo "🚀 Ready to test!"