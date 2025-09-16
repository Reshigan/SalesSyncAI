#!/bin/bash

# Fix Seeding Error Only
# This script resolves the Prisma seeding error without resetting the database

set -e

echo "🔧 Starting seeding fix..."

# Navigate to backend directory
cd /home/ubuntu/SalesSyncAI/backend

# Set environment variables
export DATABASE_URL="postgresql://salessync:salessync123@localhost:5432/salessync"
export JWT_SECRET="your-super-secret-jwt-key-change-in-production"
export NODE_ENV="production"

# Ensure we're using the simple schema (without Company model)
echo "📝 Ensuring simple schema is active..."
if [ -f "prisma/schema-simple.prisma" ]; then
    cp prisma/schema-simple.prisma prisma/schema.prisma
    echo "✅ Simple schema activated"
fi

# Regenerate Prisma client with correct schema
echo "🔄 Regenerating Prisma client..."
npx prisma generate

# Run the correct seeding script for simple schema
echo "🌱 Running simple schema seeding..."
npx ts-node prisma/seed-production-simple.ts

echo "🎉 Seeding fix completed successfully!"
echo "🌱 Database has been seeded with demo data"
echo "🔗 Login with: admin@premiumbeverages.com / admin123"