#!/bin/bash

# Deploy seeding fix to production server
# This script updates the production server with the corrected seeding script

set -e

echo "🚀 Deploying seeding fix to production server..."

# Production server details
SERVER_IP="13.246.34.207"
SERVER_USER="ubuntu"

# Copy the corrected files to production
echo "📁 Copying corrected seeding files to production..."
scp -o StrictHostKeyChecking=no \
    /workspace/project/SalesSyncAI/backend/prisma/seed-production-simple.ts \
    "$SERVER_USER@$SERVER_IP:/home/ubuntu/SalesSyncAI/backend/prisma/"

scp -o StrictHostKeyChecking=no \
    /workspace/project/SalesSyncAI/backend/prisma/schema-simple.prisma \
    "$SERVER_USER@$SERVER_IP:/home/ubuntu/SalesSyncAI/backend/prisma/"

scp -o StrictHostKeyChecking=no \
    /workspace/project/SalesSyncAI/backend/package.json \
    "$SERVER_USER@$SERVER_IP:/home/ubuntu/SalesSyncAI/backend/"

# Execute the fix on production server
echo "🔧 Executing seeding fix on production server..."
ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'EOF'
    set -e
    
    echo "📍 Current working directory: $(pwd)"
    cd /home/ubuntu/SalesSyncAI/backend
    
    echo "🔄 Backing up current schema..."
    cp prisma/schema.prisma prisma/schema-complex-backup.prisma || true
    
    echo "📝 Updating to simple schema..."
    cp prisma/schema-simple.prisma prisma/schema.prisma
    
    echo "🔄 Regenerating Prisma client..."
    npx prisma generate
    
    echo "🌱 Running corrected seeding script..."
    npm run seed
    
    echo "✅ Seeding fix deployed successfully!"
    
    echo "🔍 Verifying database contents..."
    psql -h localhost -U salessync -d salessync -c "SELECT COUNT(*) as user_count FROM users;" || echo "Database query failed"
    psql -h localhost -U salessync -d salessync -c "SELECT COUNT(*) as customer_count FROM customers;" || echo "Database query failed"
    psql -h localhost -U salessync -d salessync -c "SELECT COUNT(*) as sales_count FROM sales;" || echo "Database query failed"
    
    echo "🎉 Production seeding fix completed!"
EOF

echo "✅ Seeding fix deployment completed successfully!"
echo "🌐 Production site: https://ss.gonxt.tech"
echo "🔑 Login credentials remain the same:"
echo "   - admin@salessync.com / admin123"
echo "   - admin@premiumbeverages.com / admin123"
echo "   - manager@premiumbeverages.com / manager123"
echo "   - agent@premiumbeverages.com / agent123"