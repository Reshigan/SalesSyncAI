#!/bin/bash

# Production Update Script for SalesSyncAI
set -e

echo "🔄 Starting SalesSyncAI Production Update..."

# Configuration
IMAGE_NAME="salessyncai"
CONTAINER_NAME="salessyncai-prod"
BACKUP_CONTAINER_NAME="salessyncai-prod-backup"
PORT=3000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to rollback
rollback() {
    print_error "Update failed. Rolling back..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    docker rename $BACKUP_CONTAINER_NAME $CONTAINER_NAME 2>/dev/null || true
    docker start $CONTAINER_NAME 2>/dev/null || true
    print_error "Rollback completed. Previous version restored."
    exit 1
}

# Trap to handle errors
trap rollback ERR

print_step "1. Pre-update checks"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if current container is running
if ! docker ps | grep -q $CONTAINER_NAME; then
    print_error "Production container is not running. Use deploy-production.sh instead."
    exit 1
fi

print_step "2. Creating backup of current container"

# Stop current container and rename as backup
docker stop $CONTAINER_NAME
docker rename $CONTAINER_NAME $BACKUP_CONTAINER_NAME

print_step "3. Pulling latest code"

# Pull latest changes (assuming this script is run after git pull)
git status

print_step "4. Building new production image"

# Build new production image
docker build -f Dockerfile.production -t $IMAGE_NAME:latest .

print_step "5. Running database migrations"

# Run database migrations
docker run --rm \
    --network host \
    -v $(pwd)/backend:/app/backend \
    -w /app/backend \
    node:18-alpine sh -c "npm install && npx prisma migrate deploy"

print_step "6. Starting new production container"

# Start new production container
docker run -d \
    --name $CONTAINER_NAME \
    --network host \
    --env-file backend/.env.production \
    --restart unless-stopped \
    -v $(pwd)/logs:/app/logs \
    $IMAGE_NAME:latest

print_step "7. Waiting for application to be ready"

# Wait for container to be ready
sleep 15

print_step "8. Performing health check"

# Health check with retries
for i in {1..5}; do
    if curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
        print_status "✅ Health check passed!"
        break
    else
        if [ $i -eq 5 ]; then
            print_error "❌ Health check failed after 5 attempts"
            rollback
        fi
        print_warning "Health check attempt $i failed, retrying in 10 seconds..."
        sleep 10
    fi
done

print_step "9. Cleanup"

# Remove backup container if update was successful
docker rm $BACKUP_CONTAINER_NAME

# Remove old images
docker image prune -f

print_status "🎉 Production update completed successfully!"
print_status "Application is running at: http://localhost:$PORT"
print_status "Health check: http://localhost:$PORT/health"

# Show container status
print_status "Container status:"
docker ps | grep $CONTAINER_NAME

print_status "To view logs: docker logs -f $CONTAINER_NAME"
print_status "To monitor: docker stats $CONTAINER_NAME"