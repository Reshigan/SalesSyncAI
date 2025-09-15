#!/bin/bash

echo "🔧 FIXING EMPTY DATABASE - Tables Not Created"
echo "This will ensure migration actually creates all tables"
echo ""

cd backend

echo "📊 Step 1: Checking current database state..."
echo "Checking if containers are running..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep salessync || echo "No salessync containers running"

echo ""
echo "🗄️ Step 2: Checking database tables..."
docker exec salessync-postgres psql -U postgres -d salessync_prod -c "\dt" 2>/dev/null || echo "Cannot connect to database or no tables exist"

echo ""
echo "🧹 Step 3: Completely resetting database and migration state..."
docker exec salessync-postgres psql -U postgres -c "DROP DATABASE IF EXISTS salessync_prod;" 2>/dev/null
docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE salessync_prod;" 2>/dev/null

echo "🗑️ Step 4: Removing all migration files to force regeneration..."
rm -rf prisma/migrations/
mkdir -p prisma/migrations

echo "📝 Step 5: Generating fresh migration from schema..."
docker exec salessync-backend npx prisma migrate dev --name fresh_tables --create-only

echo "🔍 Step 6: Checking generated migration content..."
if [ -f prisma/migrations/*/migration.sql ]; then
    echo "Generated migration file content (first 30 lines):"
    cat prisma/migrations/*/migration.sql | head -30
    
    echo ""
    echo "🔧 Fixing any DATETIME references..."
    find prisma/migrations -name "*.sql" -exec sed -i 's/DATETIME/TIMESTAMP/g' {} \;
    echo "✅ DATETIME → TIMESTAMP conversion complete"
else
    echo "❌ No migration file generated!"
    exit 1
fi

echo ""
echo "🚀 Step 7: Deploying migration to create tables..."
docker exec salessync-backend npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migration deployed successfully!"
else
    echo "⚠️ Migration deploy failed, trying db push..."
    docker exec salessync-backend npx prisma db push --force-reset
    
    if [ $? -ne 0 ]; then
        echo "❌ Both migration and db push failed!"
        echo "📋 Backend logs:"
        docker logs salessync-backend --tail 10
        exit 1
    fi
fi

echo ""
echo "📊 Step 8: Verifying tables were created..."
echo "Tables in database:"
docker exec salessync-postgres psql -U postgres -d salessync_prod -c "\dt" 2>/dev/null

echo ""
echo "🔄 Step 9: Generating Prisma client..."
docker exec salessync-backend npx prisma generate

echo ""
echo "🌱 Step 10: Seeding database with demo data..."
docker exec salessync-backend node seed-production-demo.js

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 SUCCESS! Database created, migrated, and seeded!"
    echo ""
    echo "📊 Final verification - Row counts:"
    docker exec salessync-postgres psql -U postgres -d salessync_prod -c "
        SELECT 'companies' as table_name, COUNT(*) as row_count FROM companies
        UNION ALL
        SELECT 'users', COUNT(*) FROM users
        UNION ALL  
        SELECT 'leads', COUNT(*) FROM leads
        UNION ALL
        SELECT 'customers', COUNT(*) FROM customers
        ORDER BY table_name;
    " 2>/dev/null || echo "Could not verify row counts"
    
    echo ""
    echo "🧪 Testing endpoints:"
    echo "Frontend: http://localhost:8080"
    echo "Backend API: http://localhost:3001/api"
else
    echo "❌ Seeding failed even with tables created"
    echo "📋 Showing detailed error:"
    docker logs salessync-backend --tail 20
fi