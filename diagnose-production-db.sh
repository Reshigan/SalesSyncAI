#!/bin/bash

# Diagnose production database to understand login failures
# This script will check the database structure and user data

echo "🔍 Diagnosing production database for login failures..."

# Production server details
SERVER_IP="13.246.34.207"
SERVER_USER="ubuntu"

echo "🔗 Connecting to production server to diagnose database..."

# Check database structure and data
ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'EOF'
    echo "📍 Current working directory: $(pwd)"
    
    echo "🗄️ Checking database tables..."
    psql -h localhost -U salessync -d salessync -c "\dt" || echo "❌ Failed to list tables"
    
    echo "👥 Checking users table structure..."
    psql -h localhost -U salessync -d salessync -c "\d users" || echo "❌ Failed to describe users table"
    
    echo "📊 Checking user count..."
    psql -h localhost -U salessync -d salessync -c "SELECT COUNT(*) as user_count FROM users;" || echo "❌ Failed to count users"
    
    echo "🔍 Checking user data (first 3 users)..."
    psql -h localhost -U salessync -d salessync -c "SELECT id, email, role, \"createdAt\" FROM users LIMIT 3;" || echo "❌ Failed to query users"
    
    echo "🔐 Checking password field..."
    psql -h localhost -U salessync -d salessync -c "SELECT email, LENGTH(password) as password_length FROM users LIMIT 3;" || echo "❌ Failed to check passwords"
    
    echo "📋 Checking current Prisma schema..."
    cd /home/ubuntu/SalesSyncAI/backend
    head -20 prisma/schema.prisma || echo "❌ Failed to read schema"
    
    echo "🔄 Checking if Prisma client is up to date..."
    npx prisma generate --version || echo "❌ Failed to check Prisma version"
    
    echo "📝 Checking backend logs..."
    pm2 logs backend --lines 10 || echo "❌ Failed to get backend logs"
    
    echo "🌱 Checking if seeding script exists..."
    ls -la prisma/seed* || echo "❌ No seed files found"
    
    echo "📦 Checking package.json seed script..."
    grep -A 2 -B 2 "seed" package.json || echo "❌ No seed script in package.json"
EOF

echo "✅ Production database diagnosis completed!"