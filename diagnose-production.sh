#!/bin/bash

# Diagnose Production Server Issues
# This script checks the current state of the production server

echo "🔍 Diagnosing production server..."

# Navigate to backend directory
cd /home/ubuntu/SalesSyncAI/backend

echo "📋 Current directory: $(pwd)"
echo "📋 Files in backend directory:"
ls -la

echo ""
echo "📋 Current schema file:"
if [ -f "prisma/schema.prisma" ]; then
    echo "✅ schema.prisma exists"
    echo "📋 Schema models:"
    grep "^model " prisma/schema.prisma
else
    echo "❌ schema.prisma not found"
fi

echo ""
echo "📋 Available schema files:"
ls -la prisma/schema*.prisma

echo ""
echo "📋 Available seeding files:"
ls -la prisma/seed*.ts

echo ""
echo "📋 Package.json prisma configuration:"
grep -A 5 '"prisma"' package.json

echo ""
echo "📋 Current running processes:"
ps aux | grep -E "(node|prisma)" | grep -v grep

echo ""
echo "📋 Backend logs (last 20 lines):"
if [ -f "logs/backend.log" ]; then
    tail -20 logs/backend.log
else
    echo "❌ Backend log file not found"
fi

echo ""
echo "📋 Database connection test:"
export DATABASE_URL="postgresql://salessync:salessync123@localhost:5432/salessync"
if npx prisma db pull --print > /dev/null 2>&1; then
    echo "✅ Database connection successful"
    echo "📋 Current database schema:"
    npx prisma db pull --print | grep -E "(model|@@map)"
else
    echo "❌ Database connection failed"
fi

echo ""
echo "🎯 Diagnosis complete!"