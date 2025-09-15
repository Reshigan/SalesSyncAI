#!/bin/bash

echo "🔧 QUICK FIX: Create Tables and Seed Database"
echo "This will force create tables and seed with simple data"
echo ""

cd backend

echo "🗄️ Step 1: Reset database completely..."
docker exec salessync-postgres psql -U postgres -c "DROP DATABASE IF EXISTS salessync_prod;" 2>/dev/null
docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE salessync_prod;" 2>/dev/null

echo "🚀 Step 2: Force push schema to create tables..."
docker exec salessync-backend npx prisma db push --force-reset

if [ $? -eq 0 ]; then
    echo "✅ Tables created successfully!"
    
    echo "📊 Step 3: Verifying tables exist..."
    docker exec salessync-postgres psql -U postgres -d salessync_prod -c "\dt" 2>/dev/null
    
    echo ""
    echo "🔄 Step 4: Generating Prisma client..."
    docker exec salessync-backend npx prisma generate
    
    echo "🌱 Step 5: Seeding with simple data..."
    docker exec salessync-backend node seed-simple.js
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 SUCCESS! Database is ready!"
        echo ""
        echo "📊 Data verification:"
        docker exec salessync-postgres psql -U postgres -d salessync_prod -c "
            SELECT 'companies' as table_name, COUNT(*) as rows FROM companies
            UNION ALL
            SELECT 'users', COUNT(*) FROM users
            UNION ALL
            SELECT 'customers', COUNT(*) FROM customers
            UNION ALL
            SELECT 'leads', COUNT(*) FROM leads;
        " 2>/dev/null || echo "Could not verify data"
        
        echo ""
        echo "🧪 Your application is ready:"
        echo "Frontend: http://localhost:8080"
        echo "Backend API: http://localhost:3001/api"
        echo ""
        echo "🔐 Demo login:"
        echo "Email: admin@demo.com"
        echo "Password: password123"
    else
        echo "❌ Seeding failed"
        docker logs salessync-backend --tail 10
    fi
else
    echo "❌ Failed to create tables"
    docker logs salessync-backend --tail 10
fi