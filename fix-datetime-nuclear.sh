#!/bin/bash

echo "🚨 NUCLEAR OPTION: Complete Database Reset"
echo "This will destroy everything and start fresh"
echo ""

# Navigate to backend directory
cd backend

echo "🛑 Step 1: Stopping all containers..."
docker stop salessync-backend salessync-postgres salessync-redis 2>/dev/null || echo "Some containers not running"

echo "🗄️ Step 2: Removing database container and volume..."
docker rm salessync-postgres 2>/dev/null || echo "Postgres container not found"
docker volume rm salessyncai_postgres_data 2>/dev/null || echo "Volume not found"

echo "🧹 Step 3: Removing ALL migration files..."
rm -rf prisma/migrations/
mkdir -p prisma/migrations

echo "🚀 Step 4: Starting containers fresh..."
cd ..
docker-compose -f docker-compose.production.yml up -d

echo "⏳ Step 5: Waiting for database to be ready..."
sleep 15

echo "📝 Step 6: Generating completely fresh migration..."
cd backend
docker exec salessync-backend npx prisma migrate dev --name nuclear_fresh --create-only

echo "🔍 Step 7: Ensuring no DATETIME exists..."
find prisma/migrations -name "*.sql" -exec sed -i 's/DATETIME/TIMESTAMP/g' {} \; 2>/dev/null || echo "No files to fix"

echo "🚀 Step 8: Deploying migration to fresh database..."
docker exec salessync-backend npx prisma migrate deploy

echo "🔄 Step 9: Generating Prisma client..."
docker exec salessync-backend npx prisma generate

echo "🌱 Step 10: Seeding fresh database..."
docker exec salessync-backend node seed-production-demo.js

echo ""
echo "🎉 NUCLEAR RESET COMPLETE!"
echo "Everything has been rebuilt from scratch"
echo ""
echo "🧪 Testing endpoints:"
echo "Frontend: http://localhost:8080"
echo "Backend API: http://localhost:3001/api"
echo ""
echo "📊 Database status:"
docker exec salessync-postgres psql -U postgres -d salessync_prod -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "Database connection test"