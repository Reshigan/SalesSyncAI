#!/bin/bash

echo "🔧 DATETIME FIX - Working with Existing Containers"
echo "This will fix the database without recreating containers"
echo ""

cd backend

echo "📊 Step 1: Checking container status..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep salessync || echo "No salessync containers found"

echo ""
echo "🗄️ Step 2: Fixing database with existing containers..."
echo "Dropping and recreating database..."
docker exec salessync-postgres psql -U postgres -c "DROP DATABASE IF EXISTS salessync_prod;" 2>/dev/null || echo "Database doesn't exist"
docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE salessync_prod;" 2>/dev/null || echo "Failed to create database"

echo "🧹 Step 3: Clearing migration state..."
docker exec salessync-postgres psql -U postgres -d salessync_prod -c "DROP TABLE IF EXISTS _prisma_migrations;" 2>/dev/null || echo "No migration table to drop"

echo "📝 Step 4: Ensuring no DATETIME in migration files..."
find prisma/migrations -name "*.sql" -exec sed -i 's/DATETIME/TIMESTAMP/g' {} \; 2>/dev/null || echo "No migration files to fix"

echo "📋 Step 5: Showing current migration content..."
if [ -f prisma/migrations/*/migration.sql ]; then
    echo "Current migration file (first 20 lines):"
    cat prisma/migrations/*/migration.sql | head -20
else
    echo "No migration files found - will generate new ones"
fi

echo ""
echo "🚀 Step 6: Deploying migration..."
docker exec salessync-backend npx prisma migrate deploy 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Migration deployed successfully!"
else
    echo "⚠️ Migration deploy failed, trying alternative approach..."
    echo "🔄 Using db push instead..."
    docker exec salessync-backend npx prisma db push --force-reset
    
    if [ $? -eq 0 ]; then
        echo "✅ Database schema pushed successfully!"
    else
        echo "❌ Both migration deploy and db push failed"
        echo "📋 Showing backend logs:"
        docker logs salessync-backend --tail 10
        exit 1
    fi
fi

echo "🔄 Step 7: Generating Prisma client..."
docker exec salessync-backend npx prisma generate

echo "🌱 Step 8: Seeding database..."
docker exec salessync-backend node seed-production-demo.js

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 SUCCESS! Database fixed and seeded!"
    echo ""
    echo "🧪 Testing endpoints:"
    echo "Frontend: http://localhost:8080"
    echo "Backend API: http://localhost:3001/api"
    echo ""
    echo "📊 Database tables created:"
    docker exec salessync-postgres psql -U postgres -d salessync_prod -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" 2>/dev/null | head -10
else
    echo "❌ Seeding failed. Showing error details:"
    docker logs salessync-backend --tail 15
fi