#!/bin/bash

echo "🔧 Complete database reset and migration fix..."

# Navigate to backend directory
cd backend

echo "🛑 Stopping backend container to reset database..."
docker stop salessync-backend || true

echo "🗄️ Dropping and recreating database..."
docker exec salessync-postgres psql -U postgres -c "DROP DATABASE IF EXISTS salessync_prod;"
docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE salessync_prod;"

echo "🧹 Cleaning migration state..."
rm -rf prisma/migrations/
mkdir -p prisma/migrations

echo "📝 Regenerating migration from schema..."
docker start salessync-backend
sleep 5

# Generate new migration
docker exec salessync-backend npx prisma migrate dev --name init --create-only

# Ensure the generated migration uses TIMESTAMP instead of DATETIME
echo "🔍 Checking for DATETIME in new migration..."
find prisma/migrations -name "*.sql" -exec sed -i 's/DATETIME/TIMESTAMP/g' {} \;

echo "🚀 Applying migration..."
docker exec salessync-backend npx prisma migrate deploy

echo "🌱 Seeding database..."
docker exec salessync-backend node seed-production-demo.js

echo "✅ Database completely reset and seeded!"
echo ""
echo "🧪 Test your application:"
echo "Frontend: http://localhost:8080"
echo "Backend API: http://localhost:3001/api"