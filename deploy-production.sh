#!/bin/bash

# Production Deployment Script for SalesSyncAI
set -e

echo "🚀 Starting SalesSyncAI Production Deployment..."

# Configuration
IMAGE_NAME="salessyncai"
CONTAINER_NAME="salessyncai-prod"
PORT=3000
DB_PORT=5432

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env.production exists
if [ ! -f "backend/.env.production" ]; then
    print_warning ".env.production not found. Creating template..."
    cp backend/.env.production.template backend/.env.production 2>/dev/null || {
        print_error "Please create backend/.env.production with your production configuration"
        exit 1
    }
fi

# Stop existing container if running
print_status "Stopping existing container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Build production image
print_status "Building production Docker image..."
docker build -f Dockerfile.production -t $IMAGE_NAME:latest .

# Check if PostgreSQL is running
print_status "Checking PostgreSQL connection..."
if ! docker run --rm --network host postgres:13 pg_isready -h localhost -p $DB_PORT > /dev/null 2>&1; then
    print_warning "PostgreSQL not detected. Starting PostgreSQL container..."
    docker run -d \
        --name salessyncai-postgres \
        --network host \
        -e POSTGRES_DB=salessyncai_prod \
        -e POSTGRES_USER=salessyncai \
        -e POSTGRES_PASSWORD=secure_password_change_this \
        -v salessyncai_postgres_data:/var/lib/postgresql/data \
        postgres:13
    
    print_status "Waiting for PostgreSQL to be ready..."
    sleep 10
fi

# Run database migrations
print_status "Running database migrations..."
docker run --rm \
    --network host \
    -v $(pwd)/backend:/app/backend \
    -w /app/backend \
    node:18-alpine sh -c "npm install && npx prisma migrate deploy && npx prisma db seed"

# Start production container
print_status "Starting production container..."
docker run -d \
    --name $CONTAINER_NAME \
    --network host \
    --env-file backend/.env.production \
    --restart unless-stopped \
    -v $(pwd)/logs:/app/logs \
    $IMAGE_NAME:latest

# Wait for container to be ready
print_status "Waiting for application to be ready..."
sleep 10

# Health check
print_status "Performing health check..."
if curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
    print_status "✅ Production deployment successful!"
    print_status "Application is running at: http://localhost:$PORT"
    print_status "Health check: http://localhost:$PORT/health"
else
    print_error "❌ Health check failed. Check container logs:"
    docker logs $CONTAINER_NAME --tail 50
    exit 1
fi

# Show container status
print_status "Container status:"
docker ps | grep $CONTAINER_NAME

print_status "🎉 Deployment completed successfully!"
print_status "To view logs: docker logs -f $CONTAINER_NAME"
print_status "To stop: docker stop $CONTAINER_NAME"
print_status "To restart: docker restart $CONTAINER_NAME"