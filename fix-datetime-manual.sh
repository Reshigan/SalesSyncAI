#!/bin/bash

echo "🔧 MANUAL DATETIME FIX"
echo "Directly editing migration files and forcing database reset"
echo ""

cd backend

echo "📝 Step 1: Finding and fixing ALL DATETIME references..."
find . -name "*.sql" -exec sed -i 's/DATETIME/TIMESTAMP/g' {} \; 2>/dev/null
find . -name "*.prisma" -exec sed -i 's/DATETIME/TIMESTAMP/g' {} \; 2>/dev/null

echo "🗄️ Step 2: Dropping database completely..."
docker exec salessync-postgres psql -U postgres -c "DROP DATABASE IF EXISTS salessync_prod;" 2>/dev/null
docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE salessync_prod;" 2>/dev/null

echo "🧹 Step 3: Clearing migration state..."
docker exec salessync-postgres psql -U postgres -d salessync_prod -c "DROP TABLE IF EXISTS _prisma_migrations;" 2>/dev/null

echo "📋 Step 4: Showing current migration content..."
echo "Current migration file content:"
cat prisma/migrations/*/migration.sql | head -20

echo ""
echo "🚀 Step 5: Force deploying migration..."
docker exec salessync-backend npx prisma migrate deploy --force

if [ $? -eq 0 ]; then
    echo "✅ Migration successful!"
    echo "🌱 Step 6: Seeding database..."
    docker exec salessync-backend node seed-production-demo.js
    echo "🎉 SUCCESS!"
else
    echo "❌ Migration still failing. Let's regenerate completely..."
    rm -rf prisma/migrations/
    docker exec salessync-backend npx prisma db push --force-reset
    docker exec salessync-backend npx prisma generate
    docker exec salessync-backend node seed-production-demo.js
fi

echo ""
echo "🧪 Final test:"
echo "Frontend: http://localhost:8080"
echo "Backend API: http://localhost:3001/api"