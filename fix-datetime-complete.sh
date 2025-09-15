#!/bin/bash

echo "🔧 COMPLETE DATETIME FIX - Regenerating Everything"
echo "This will completely reset and regenerate the database schema"
echo ""

# Navigate to backend directory
cd backend

echo "🛑 Step 1: Stopping backend container..."
docker stop salessync-backend 2>/dev/null || echo "Backend not running"

echo "🗄️ Step 2: Completely destroying database..."
docker exec salessync-postgres psql -U postgres -c "DROP DATABASE IF EXISTS salessync_prod;" 2>/dev/null
docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE salessync_prod;"

echo "🧹 Step 3: Removing ALL migration files..."
rm -rf prisma/migrations/
mkdir -p prisma/migrations

echo "🚀 Step 4: Starting backend container..."
docker start salessync-backend
sleep 10

echo "📝 Step 5: Generating fresh migration from schema..."
docker exec salessync-backend npx prisma migrate dev --name fresh_init --create-only

echo "🔍 Step 6: Checking for DATETIME in new migration..."
if find prisma/migrations -name "*.sql" -exec grep -l "DATETIME" {} \; | grep -q .; then
    echo "⚠️ Found DATETIME, fixing..."
    find prisma/migrations -name "*.sql" -exec sed -i 's/DATETIME/TIMESTAMP/g' {} \;
    echo "✅ Fixed DATETIME → TIMESTAMP"
else
    echo "✅ No DATETIME found - migration is clean"
fi

echo "🚀 Step 7: Deploying fresh migration..."
docker exec salessync-backend npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migration deployed successfully!"
    
    echo "🔄 Step 8: Generating Prisma client..."
    docker exec salessync-backend npx prisma generate
    
    echo "🌱 Step 9: Seeding database..."
    docker exec salessync-backend node seed-production-demo.js
    
    echo ""
    echo "🎉 SUCCESS! Database completely regenerated!"
    echo "Frontend: http://localhost:8080"
    echo "Backend API: http://localhost:3001/api"
    echo ""
    echo "🧪 Testing database connection..."
    docker exec salessync-backend npx prisma db pull --print 2>/dev/null | head -5 || echo "Database connection test completed"
else
    echo "❌ Migration failed. Showing error details..."
    docker logs salessync-backend --tail 20
fi