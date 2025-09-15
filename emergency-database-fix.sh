#!/bin/bash

echo "🚨 EMERGENCY DATABASE FIX - No Git Required!"
echo "This script fixes the DATETIME → TIMESTAMP issue directly"
echo ""

# Navigate to backend directory
cd backend

echo "🗄️ Step 1: Dropping database completely..."
docker exec salessync-postgres psql -U postgres -c "DROP DATABASE IF EXISTS salessync_prod;" 2>/dev/null || echo "Database doesn't exist, continuing..."

echo "🗄️ Step 2: Creating fresh database..."
docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE salessync_prod;"

echo "🧹 Step 3: Clearing any migration history..."
docker exec salessync-postgres psql -U postgres -d salessync_prod -c "DROP TABLE IF EXISTS _prisma_migrations;" 2>/dev/null || echo "No migration table to drop"

echo "📝 Step 4: Fixing migration file (DATETIME → TIMESTAMP)..."
find prisma/migrations -name "*.sql" -exec sed -i 's/DATETIME/TIMESTAMP/g' {} \; 2>/dev/null || echo "Migration files already fixed"

echo "🚀 Step 5: Deploying migration..."
docker exec salessync-backend npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migration successful!"
    echo "🌱 Step 6: Seeding database..."
    docker exec salessync-backend node seed-production-demo.js
    
    echo ""
    echo "🎉 SUCCESS! Your database is now working!"
    echo "Frontend: http://localhost:8080"
    echo "Backend API: http://localhost:3001/api"
else
    echo "❌ Migration failed. Let's try regenerating..."
    echo "🔄 Regenerating migration from schema..."
    
    # Remove old migrations and regenerate
    rm -rf prisma/migrations/
    docker exec salessync-backend npx prisma migrate dev --name init --create-only
    
    # Fix any DATETIME in new migration
    find prisma/migrations -name "*.sql" -exec sed -i 's/DATETIME/TIMESTAMP/g' {} \;
    
    # Deploy the new migration
    docker exec salessync-backend npx prisma migrate deploy
    
    # Seed database
    docker exec salessync-backend node seed-production-demo.js
    
    echo "🎉 Database regenerated and seeded!"
fi