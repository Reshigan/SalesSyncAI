#!/bin/bash

# Quick fix for port conflicts - run this immediately
echo "🔧 Quick fixing port conflicts..."

# Stop conflicting services
sudo systemctl stop redis-server 2>/dev/null || true
sudo systemctl stop postgresql 2>/dev/null || true
sudo systemctl stop apache2 2>/dev/null || true

# Stop existing containers
docker compose -f docker-compose.production.yml down --remove-orphans 2>/dev/null || true

# Clean up
docker system prune -f

# Get public IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")

# Create new environment with alternative ports
cat > .env << EOF
NODE_ENV=production
POSTGRES_PASSWORD=SalesSync2024!Prod
REDIS_PASSWORD=SalesSync2024!Redis
JWT_SECRET=SalesSync2024!JWT!Secret!Key!Production
JWT_REFRESH_SECRET=SalesSync2024!JWT!Refresh!Secret!Key!Production
CORS_ORIGIN=*
REACT_APP_API_URL=http://${PUBLIC_IP}:3001/api
EOF

# Modify docker-compose to use different ports
sed -i 's/"80:80"/"8080:80"/g' docker-compose.production.yml
sed -i 's/"3000:3000"/"3001:3000"/g' docker-compose.production.yml
sed -i 's/"5432:5432"/"5433:5432"/g' docker-compose.production.yml
sed -i 's/"6379:6379"/"6380:6379"/g' docker-compose.production.yml

# Update API URL in docker-compose
sed -i "s|http://localhost:3000/api|http://${PUBLIC_IP}:3001/api|g" docker-compose.production.yml

echo "✅ Port conflicts fixed! Now run:"
echo "docker compose -f docker-compose.production.yml up -d --build"
echo ""
echo "Your app will be available at:"
echo "🌐 Frontend: http://${PUBLIC_IP}:8080"
echo "🔗 API: http://${PUBLIC_IP}:3001/api"