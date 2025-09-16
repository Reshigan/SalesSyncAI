#!/bin/bash

# 🔧 Fix PostgreSQL Database Setup
# This script ensures PostgreSQL is properly installed, configured, and running

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" >&2
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Configuration
DOMAIN="salessync.gonxt.tech"
APP_DIR="/opt/salessync"
DB_NAME="salessync_production"
DB_USER="salessync"
DB_PASS="salessync_secure_password_2024"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

log "🐘 Setting up PostgreSQL database..."

# Install PostgreSQL if not installed
if ! command -v psql &> /dev/null; then
    log "Installing PostgreSQL..."
    apt-get update
    apt-get install -y postgresql postgresql-contrib
else
    log "PostgreSQL is already installed"
fi

# Start PostgreSQL service
log "Starting PostgreSQL service..."
systemctl start postgresql || {
    error "Failed to start PostgreSQL"
    systemctl status postgresql
    exit 1
}

systemctl enable postgresql

# Wait for PostgreSQL to start
log "Waiting for PostgreSQL to start..."
sleep 5

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    error "PostgreSQL is not running"
    systemctl status postgresql
    exit 1
fi

log "✅ PostgreSQL is running"

# Test basic connection
log "Testing PostgreSQL connection..."
if ! sudo -u postgres psql -c "SELECT version();" > /dev/null 2>&1; then
    error "Cannot connect to PostgreSQL"
    exit 1
fi

log "✅ PostgreSQL connection successful"

# Drop existing user and database if they exist (clean slate)
log "Cleaning up existing database and user..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true

# Create database user
log "Creating database user '$DB_USER'..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
sudo -u postgres psql -c "ALTER USER $DB_USER SUPERUSER;"

# Create database
log "Creating database '$DB_NAME'..."
sudo -u postgres createdb -O $DB_USER $DB_NAME

# Grant permissions
log "Setting up database permissions..."
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"

# Test connection with new user
log "Testing connection with new user..."
if ! PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    error "Cannot connect with new user credentials"
    exit 1
fi

log "✅ Database user and database created successfully"

# Configure PostgreSQL for better performance
log "Configuring PostgreSQL for production..."

# Find PostgreSQL config file
PG_VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | grep -oP '\d+\.\d+' | head -1)
PG_CONFIG="/etc/postgresql/$PG_VERSION/main/postgresql.conf"

if [ -f "$PG_CONFIG" ]; then
    log "Updating PostgreSQL configuration..."
    
    # Backup original config
    cp "$PG_CONFIG" "$PG_CONFIG.backup"
    
    # Update configuration for better performance
    cat >> "$PG_CONFIG" << EOF

# SalesSync Production Settings
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_connections = 200
EOF
    
    # Restart PostgreSQL to apply changes
    log "Restarting PostgreSQL to apply configuration changes..."
    systemctl restart postgresql
    
    # Wait for restart
    sleep 5
    
    # Verify it's still running
    if ! systemctl is-active --quiet postgresql; then
        warning "PostgreSQL restart failed, reverting config..."
        cp "$PG_CONFIG.backup" "$PG_CONFIG"
        systemctl restart postgresql
        sleep 5
    fi
else
    warning "PostgreSQL config file not found, skipping performance tuning"
fi

log "✅ PostgreSQL setup completed"

# Now continue with SalesSync database setup
log "🚀 Setting up SalesSync database..."

cd $APP_DIR/backend

# Set environment variable for database connection
export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

log "Running Prisma migrations..."
npx prisma migrate deploy

log "Seeding database with demo data..."
node seed-simple.js

log "Building TypeScript application..."
npx tsc --skipLibCheck

log "✅ SalesSync database setup completed!"

# Test the application build
if [ -f "dist/index.js" ]; then
    log "✅ Application built successfully"
else
    error "❌ Application build failed - dist/index.js not found"
    exit 1
fi

log "🎉 Database setup and application build completed successfully!"
log "You can now start the application with PM2 or continue with the full installation script."

# Display connection info
echo ""
echo "📋 Database Connection Info:"
echo "  • Host: localhost"
echo "  • Port: 5432"
echo "  • Database: $DB_NAME"
echo "  • User: $DB_USER"
echo "  • Password: $DB_PASS"
echo ""
echo "🔗 Connection String:"
echo "  postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo ""