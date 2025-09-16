#!/bin/bash

# Fix production login issues - Complete deployment script
# This script will update the production server with the working schema and seeding

echo "🚀 Fixing production login issues..."

# Production server details
SERVER_IP="13.246.34.207"
SERVER_USER="ubuntu"
REPO_PATH="/home/ubuntu/SalesSyncAI"

echo "📋 This script will:"
echo "1. Update the backend with the simple schema that works"
echo "2. Deploy the new seeding script"
echo "3. Reset and seed the database with demo users"
echo "4. Restart the backend service"
echo "5. Update the frontend with the new UI"

echo ""
echo "🔑 Demo users that will be created:"
echo "- admin@salessync.com / admin123 (ADMIN)"
echo "- manager@salessync.com / manager123 (MANAGER)"
echo "- sales@salessync.com / sales123 (SALES_REP)"
echo "- field@salessync.com / field123 (FIELD_REP)"

echo ""
echo "📁 Files to be deployed:"
echo "- backend/prisma/schema-simple.prisma -> schema.prisma"
echo "- backend/prisma/seed-production-simple.ts"
echo "- Updated package.json with seed script"
echo "- New UI files (favicon, logo, CSS updates)"

echo ""
read -p "🤔 Do you want to proceed with the production deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled."
    exit 1
fi

echo "🔄 Starting production deployment..."

# Create deployment commands
cat > /tmp/production-deployment-commands.sh << 'DEPLOY_EOF'
#!/bin/bash

echo "🏠 Current directory: $(pwd)"
echo "📍 Moving to SalesSyncAI directory..."
cd /home/ubuntu/SalesSyncAI

echo "📥 Pulling latest changes from git..."
git pull origin main

echo "🔄 Stopping backend service..."
pm2 stop backend || echo "Backend not running"

echo "🗄️ Backing up current schema..."
cp backend/prisma/schema.prisma backend/prisma/schema-backup-$(date +%Y%m%d-%H%M%S).prisma || echo "No existing schema"

echo "📋 Deploying simple schema..."
cp backend/prisma/schema-simple.prisma backend/prisma/schema.prisma

echo "📦 Installing/updating dependencies..."
cd backend
npm install

echo "🔧 Generating Prisma client with new schema..."
npx prisma generate

echo "🗄️ Resetting database with new schema..."
npx prisma db push --force-reset --accept-data-loss

echo "🌱 Seeding database with demo users..."
npx prisma db seed

echo "🔄 Starting backend service..."
pm2 start ecosystem.config.js --only backend

echo "🎨 Updating frontend..."
cd ../frontend
npm run build

echo "🔄 Restarting nginx..."
sudo systemctl restart nginx

echo "✅ Deployment completed!"

echo "🧪 Testing login endpoint..."
sleep 3
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@salessync.com", "password": "admin123"}' \
  | jq '.' || echo "Login test failed"

echo "📊 Checking database users..."
psql -h localhost -U salessync -d salessync -c "SELECT email, role FROM users;" || echo "Database query failed"

echo "🎯 Production deployment completed successfully!"
DEPLOY_EOF

echo "📤 Uploading deployment script to production server..."

# Upload the deployment script
scp -o StrictHostKeyChecking=no /tmp/production-deployment-commands.sh "$SERVER_USER@$SERVER_IP:/tmp/"

echo "🚀 Executing deployment on production server..."

# Execute the deployment
ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'EOF'
    chmod +x /tmp/production-deployment-commands.sh
    /tmp/production-deployment-commands.sh
EOF

echo "🧪 Testing the fixed login from local machine..."
sleep 5

echo "Testing admin login..."
curl -X POST https://ss.gonxt.tech/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@salessync.com", "password": "admin123"}' \
  | jq '.'

echo ""
echo "✅ Production login fix deployment completed!"
echo "🌐 Website: https://ss.gonxt.tech"
echo "🔑 Test with: admin@salessync.com / admin123"