#!/bin/bash

echo "🔧 Fixing PostgreSQL migration (DATETIME → TIMESTAMP)..."

# Navigate to backend directory
cd backend

# Fix the migration file
echo "📝 Updating migration file..."
sed -i 's/DATETIME/TIMESTAMP/g' prisma/migrations/20250915103315_init/migration.sql

echo "🗄️ Resetting database and applying fixed migration..."
docker exec salessync-backend npx prisma migrate reset --force --skip-seed

echo "🌱 Running database seeding..."
docker exec salessync-backend node seed-production-demo.js

echo "✅ Database migration and seeding completed!"
echo ""
echo "🧪 Test your application:"
echo "Frontend: http://localhost:8080"
echo "Backend API: http://localhost:3001/api"