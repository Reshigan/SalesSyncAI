#!/bin/bash

# SalesSync AI - Production Deployment with Demo Data
# This script deploys the application and seeds it with demo data for presentations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="ssai.gonxt.tech"
APP_DIR="$HOME/SalesSyncAI"
COMPOSE_FILE="docker-compose.prod.yml"

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

log "🚀 Starting SalesSync AI Production Deployment with Demo Data"
log "Domain: $DOMAIN"
log "App Directory: $APP_DIR"

# Check if we're in the right directory
if [ ! -f "$COMPOSE_FILE" ]; then
    error "Docker compose file not found. Please run this script from the SalesSyncAI directory."
    exit 1
fi

# Step 1: Pull latest changes
log "📥 Pulling latest changes from repository..."
git pull origin main

# Step 2: Stop existing containers
log "🛑 Stopping existing containers..."
docker compose -f $COMPOSE_FILE down --remove-orphans 2>/dev/null || true

# Step 3: Build and start services
log "🏗️ Building and starting services..."
docker compose -f $COMPOSE_FILE build --no-cache
docker compose -f $COMPOSE_FILE up -d

# Step 4: Wait for services to be ready
log "⏳ Waiting for services to start..."
sleep 45

# Step 5: Check if backend is ready
log "🏥 Checking backend service health..."
for i in {1..30}; do
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        log "✅ Backend service is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Backend service failed to start"
        docker compose -f $COMPOSE_FILE logs backend
        exit 1
    fi
    sleep 2
done

# Step 6: Run database migrations
log "🗄️ Running database migrations..."
docker compose -f $COMPOSE_FILE exec -T backend npx prisma migrate deploy

# Step 7: Generate Prisma client
log "🔧 Generating Prisma client..."
docker compose -f $COMPOSE_FILE exec -T backend npx prisma generate

# Step 8: Seed demo data
log "🌱 Seeding database with demo data..."
if docker compose -f $COMPOSE_FILE exec -T backend node seed-production-demo.js; then
    log "✅ Demo data seeded successfully"
else
    warning "Demo seeding failed, trying alternative method..."
    docker compose -f $COMPOSE_FILE exec -T backend npm run seed:demo
fi

# Step 9: Final health check
log "🏁 Performing final health check..."
sleep 10

# Check frontend
for i in {1..15}; do
    if curl -f http://localhost:3000 >/dev/null 2>&1; then
        log "✅ Frontend service is healthy"
        break
    fi
    if [ $i -eq 15 ]; then
        warning "Frontend service may not be ready yet"
    fi
    sleep 2
done

# Step 10: Display service status
log "📊 Current service status:"
docker compose -f $COMPOSE_FILE ps

echo
echo "=== DEPLOYMENT COMPLETE ==="
echo "✅ Services built and started"
echo "✅ Database migrations applied"
echo "✅ Demo data seeded"
echo "✅ Application ready for demonstration"
echo
echo "🔗 Access URLs:"
echo "   Frontend: http://$DOMAIN (or http://localhost:3000)"
echo "   Backend API: http://$DOMAIN/api (or http://localhost:3001)"
echo
echo "🔑 DEMO LOGIN CREDENTIALS:"
echo "   Company: TechCorp Solutions"
echo "   Admin: demo@techcorp.com / Demo123!"
echo "   Manager: manager@techcorp.com / Manager123!"
echo "   Agent: agent1@techcorp.com / Agent123!"
echo
echo "📋 Demo includes:"
echo "   • 16 tech products (laptops, phones, accessories)"
echo "   • 8 diverse customers (corporate, retail, education)"
echo "   • 25 sample visits with realistic data"
echo "   • 15 sales orders across different products"
echo "   • 1 active marketing campaign"
echo
echo "📖 For detailed demo instructions, see: DEMO_CREDENTIALS.md"
echo
log "🎉 SalesSync AI deployment with demo data completed successfully!"

# Optional: Open browser to application
if command -v xdg-open > /dev/null; then
    info "Opening application in browser..."
    xdg-open "http://$DOMAIN" 2>/dev/null || true
elif command -v open > /dev/null; then
    info "Opening application in browser..."
    open "http://$DOMAIN" 2>/dev/null || true
fi