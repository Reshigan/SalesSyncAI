#!/bin/bash

echo "🔧 Force database reset (simpler approach)..."

# Navigate to backend directory
cd backend

echo "🗄️ Dropping database completely..."
docker exec salessync-postgres psql -U postgres -c "DROP DATABASE IF EXISTS salessync_prod;"
docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE salessync_prod;"

echo "🧹 Clearing migration history..."
docker exec salessync-postgres psql -U postgres -d salessync_prod -c "DROP TABLE IF EXISTS _prisma_migrations;"

echo "🚀 Deploying migration (fresh start)..."
docker exec salessync-backend npx prisma migrate deploy

echo "🌱 Seeding database..."
docker exec salessync-backend node seed-production-demo.js

echo "✅ Database force reset completed!"
echo ""
echo "🧪 Test your application:"
echo "Frontend: http://localhost:8080"
echo "Backend API: http://localhost:3001/api"