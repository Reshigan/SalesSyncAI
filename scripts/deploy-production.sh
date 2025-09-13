#!/bin/bash

# SalesSync Production Deployment Script
# Deploys the complete SalesSync platform to production environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 SalesSync Production Deployment${NC}"
echo -e "${BLUE}===================================${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed.${NC}"
    exit 1
fi

# Backup existing data (if any)
echo -e "${YELLOW}📦 Creating backup of existing data...${NC}"
if [ -d "backups" ]; then
    BACKUP_DIR="backups/backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup database if running
    if docker ps | grep -q salessync-postgres-prod; then
        echo -e "${YELLOW}💾 Backing up database...${NC}"
        docker exec salessync-postgres-prod pg_dump -U salessync_user salessync_prod > "$BACKUP_DIR/database.sql"
    fi
    
    # Backup uploads if they exist
    if [ -d "backend/uploads" ]; then
        echo -e "${YELLOW}📁 Backing up uploads...${NC}"
        cp -r backend/uploads "$BACKUP_DIR/"
    fi
    
    echo -e "${GREEN}✅ Backup created at: $BACKUP_DIR${NC}"
fi

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down --remove-orphans

# Pull latest images
echo -e "${YELLOW}📥 Pulling latest base images...${NC}"
docker-compose -f docker-compose.prod.yml pull

# Build production images
echo -e "${YELLOW}🔨 Building production images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# Create necessary directories
echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p backend/logs backend/uploads ssl nginx/logs

# Generate SSL certificates (self-signed for development)
if [ ! -f "ssl/cert.pem" ]; then
    echo -e "${YELLOW}🔐 Generating SSL certificates...${NC}"
    mkdir -p ssl
    openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes \
        -subj "/C=ZA/ST=Gauteng/L=Johannesburg/O=SalesSync/OU=IT/CN=salessync.com"
    echo -e "${GREEN}✅ SSL certificates generated${NC}"
fi

# Start the production environment
echo -e "${YELLOW}🚀 Starting production environment...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 30

# Check service health
echo -e "${YELLOW}🏥 Checking service health...${NC}"

# Check PostgreSQL
if docker exec salessync-postgres-prod pg_isready -U salessync_user -d salessync_prod > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is healthy${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not healthy${NC}"
fi

# Check Redis
if docker exec salessync-redis-prod redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is healthy${NC}"
else
    echo -e "${RED}❌ Redis is not healthy${NC}"
fi

# Check Backend API
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API is healthy${NC}"
else
    echo -e "${RED}❌ Backend API is not healthy${NC}"
fi

# Check Frontend
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo -e "${RED}❌ Frontend is not healthy${NC}"
fi

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
docker exec salessync-backend-prod npx prisma migrate deploy

# Seed production data (if needed)
if [ "$1" = "--seed" ]; then
    echo -e "${YELLOW}🌱 Seeding production database...${NC}"
    docker exec salessync-backend-prod npm run seed:prod
fi

# Show deployment summary
echo -e "${GREEN}🎉 Production deployment completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}📍 Frontend URL: http://localhost${NC}"
echo -e "${GREEN}📍 Backend API: http://localhost:3000${NC}"
echo -e "${GREEN}📍 API Documentation: http://localhost:3000/api/docs${NC}"
echo -e "${GREEN}📍 Database: localhost:5432${NC}"
echo -e "${GREEN}📍 Redis: localhost:6379${NC}"

echo -e "${BLUE}📋 Container Status:${NC}"
docker-compose -f docker-compose.prod.yml ps

echo -e "${BLUE}📊 Resource Usage:${NC}"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

echo -e "${YELLOW}💡 Useful Commands:${NC}"
echo -e "  View logs: docker-compose -f docker-compose.prod.yml logs -f [service]"
echo -e "  Stop services: docker-compose -f docker-compose.prod.yml down"
echo -e "  Restart service: docker-compose -f docker-compose.prod.yml restart [service]"
echo -e "  Scale service: docker-compose -f docker-compose.prod.yml up -d --scale backend=3"

echo -e "${GREEN}🔒 Security Notes:${NC}"
echo -e "  - Change default passwords in .env.production"
echo -e "  - Configure proper SSL certificates for HTTPS"
echo -e "  - Set up firewall rules for production"
echo -e "  - Configure monitoring and alerting"
echo -e "  - Set up automated backups"