#!/bin/bash

echo "🚀 COMPLETE DEPLOYMENT FIX - Start to Finish"
echo "This will start containers, create tables, and seed database"
echo ""

# Cleanup any existing containers
echo "🧹 Step 1: Cleaning up existing containers..."
docker stop salessync-frontend salessync-backend salessync-postgres salessync-redis salessync-nginx 2>/dev/null || echo "No containers to stop"
docker rm salessync-frontend salessync-backend salessync-postgres salessync-redis salessync-nginx 2>/dev/null || echo "No containers to remove"

echo "🚀 Step 2: Starting all containers..."
docker-compose -f docker-compose.production.yml up -d

echo "⏳ Step 3: Waiting for containers to be ready..."
sleep 15

echo "📊 Step 4: Checking container status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🗄️ Step 5: Setting up database..."
echo "Creating database..."
docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE IF NOT EXISTS salessync_prod;" 2>/dev/null || docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE salessync_prod;" 2>/dev/null

echo "🚀 Step 6: Creating tables with db push..."
docker exec salessync-backend npx prisma db push --force-reset

if [ $? -eq 0 ]; then
    echo "✅ Tables created successfully!"
    
    echo "📊 Step 7: Verifying tables exist..."
    docker exec salessync-postgres psql -U postgres -d salessync_prod -c "\dt" 2>/dev/null
    
    echo ""
    echo "📁 Step 8: Copying seed file to container..."
    docker cp backend/seed-simple.js salessync-backend:/app/seed-simple.js
    
    echo "🔄 Step 9: Generating Prisma client..."
    docker exec salessync-backend npx prisma generate
    
    echo "🌱 Step 10: Seeding database..."
    docker exec salessync-backend node seed-simple.js
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 DEPLOYMENT SUCCESSFUL!"
        echo ""
        echo "📊 Database verification:"
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
        echo "🌐 Your SalesSyncAI is ready:"
        echo "Frontend: http://localhost:8080"
        echo "Backend API: http://localhost:3001/api"
        echo "Health Check: http://localhost:3001/health"
        echo ""
        echo "🔐 Demo credentials:"
        echo "Email: admin@demo.com"
        echo "Password: password123"
        echo ""
        echo "📊 Container status:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        
    else
        echo "❌ Seeding failed"
        echo "📋 Backend logs:"
        docker logs salessync-backend --tail 15
    fi
else
    echo "❌ Failed to create tables"
    echo "📋 Backend logs:"
    docker logs salessync-backend --tail 15
    echo ""
    echo "📋 PostgreSQL logs:"
    docker logs salessync-postgres --tail 10
fi