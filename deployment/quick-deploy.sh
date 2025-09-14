#!/bin/bash

# SalesSync AI - Quick Deployment Script
# Version: 1.0.0
# For development and testing environments

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -d "backend" ] && [ ! -d "frontend" ]; then
    error "Please run this script from the SalesSyncAI root directory"
fi

log "🚀 Starting SalesSync AI Quick Deployment"

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    error "PostgreSQL is not running. Please start PostgreSQL first: sudo systemctl start postgresql"
fi

# Check if Redis is running
if ! systemctl is-active --quiet redis-server; then
    warn "Redis is not running. Starting Redis..."
    sudo systemctl start redis-server || error "Failed to start Redis"
fi

# Setup backend
log "Setting up backend..."
cd backend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    log "Installing backend dependencies..."
    npm install
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    log "Creating backend .env file..."
    cat > .env << EOF
DATABASE_URL="postgresql://postgres:@localhost:5432/salessync"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="dev-secret-key"
JWT_EXPIRES_IN="24h"
PORT=12000
NODE_ENV=development
API_VERSION="v1"
BCRYPT_ROUNDS=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
CORS_ORIGIN="*"
LOG_LEVEL="debug"
EOF
fi

# Generate Prisma client and push schema
log "Setting up database..."
npx prisma generate
npx prisma db push

# Start backend in background
log "Starting backend server..."
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid

# Setup frontend
log "Setting up frontend..."
cd ../frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    log "Installing frontend dependencies..."
    npm install
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    log "Creating frontend .env file..."
    cat > .env << EOF
REACT_APP_API_URL=http://localhost:12000/api
REACT_APP_APP_NAME="SalesSync AI"
REACT_APP_VERSION="1.0.0"
EOF
fi

# Start frontend in background
log "Starting frontend server..."
PORT=8080 HOST=0.0.0.0 npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid

# Wait for services to start
log "Waiting for services to start..."
sleep 15

# Health checks
log "Performing health checks..."

# Check backend
if curl -s http://localhost:12000/health | grep -q "healthy"; then
    log "✅ Backend is healthy"
else
    warn "❌ Backend health check failed"
fi

# Check frontend
if curl -s http://localhost:8080 | grep -q "SalesSync"; then
    log "✅ Frontend is healthy"
else
    warn "❌ Frontend health check failed"
fi

cd ..

# Create stop script
cat > stop-services.sh << 'EOF'
#!/bin/bash
echo "Stopping SalesSync services..."

if [ -f "backend.pid" ]; then
    BACKEND_PID=$(cat backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        echo "Backend stopped"
    fi
    rm -f backend.pid
fi

if [ -f "frontend.pid" ]; then
    FRONTEND_PID=$(cat frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID
        echo "Frontend stopped"
    fi
    rm -f frontend.pid
fi

echo "All services stopped"
EOF

chmod +x stop-services.sh

log "🎉 SalesSync AI Quick Deployment Complete!"
echo
echo "=== ACCESS URLS ==="
echo "Frontend: http://localhost:8080"
echo "Backend API: http://localhost:12000"
echo "Health Check: http://localhost:12000/health"
echo "API Docs: http://localhost:12000/api/docs"
echo
echo "=== LOGS ==="
echo "Backend logs: tail -f backend.log"
echo "Frontend logs: tail -f frontend.log"
echo
echo "=== STOP SERVICES ==="
echo "Run: ./stop-services.sh"
echo
log "Deployment completed at $(date)"