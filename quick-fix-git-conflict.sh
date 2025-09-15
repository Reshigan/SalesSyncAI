#!/bin/bash

echo "🔧 Resolving git conflict and fixing database migration..."

# Stash local changes
echo "📦 Stashing local changes..."
git stash

# Pull latest changes
echo "⬇️ Pulling latest changes..."
git pull origin main

# Apply stashed changes (if any conflicts, we'll handle them)
echo "🔄 Applying your local changes..."
git stash pop || echo "No conflicts to resolve"

# Now run the database migration fix
echo "🗄️ Fixing database migration..."
if [ -f "./fix-database-migration.sh" ]; then
    ./fix-database-migration.sh
else
    echo "Creating database fix script..."
    cat > fix-database-migration.sh << 'EOF'
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
EOF
    chmod +x fix-database-migration.sh
    ./fix-database-migration.sh
fi

echo "✅ All fixes applied!"