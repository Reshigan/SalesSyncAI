#!/bin/bash

# =============================================================================
# Fix Database Permissions for SalesSync
# Resolves "permission denied for schema public" errors
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
DB_NAME="salessync_production"
DB_USER="salessync"
DB_PASSWORD="salessync_secure_password_2024"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

log "Fixing database permissions for SalesSync..."

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    log "Starting PostgreSQL..."
    systemctl start postgresql
fi

# Create database if it doesn't exist
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || {
    log "Creating database: $DB_NAME"
    sudo -u postgres createdb "$DB_NAME"
}

# Create user if doesn't exist
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = '$DB_USER'" | grep -q 1 || {
    log "Creating database user: $DB_USER"
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
}

# Grant all necessary permissions
log "Granting database permissions..."

# Make user superuser (for migrations)
sudo -u postgres psql -c "ALTER USER $DB_USER SUPERUSER;"

# Grant database privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"

# Grant schema permissions
log "Setting up schema permissions..."
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;"

# Set default privileges for future objects
log "Setting default privileges..."
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO $DB_USER;"

# Test connection
log "Testing database connection..."
if sudo -u postgres psql -d "$DB_NAME" -c "SELECT current_user, current_database();" > /dev/null 2>&1; then
    log "✅ Database connection test passed"
else
    error "❌ Database connection test failed"
    exit 1
fi

# Test user permissions
log "Testing user permissions..."
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_user, current_database();" > /dev/null 2>&1; then
    log "✅ User permission test passed"
else
    error "❌ User permission test failed"
    exit 1
fi

log "🎉 Database permissions fixed successfully!"
echo
log "Database connection details:"
log "  Host: localhost"
log "  Port: 5432"
log "  Database: $DB_NAME"
log "  User: $DB_USER"
log "  Password: $DB_PASSWORD"
echo
log "Connection string:"
log "  DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME\""
echo
log "You can now run Prisma migrations:"
log "  cd /opt/salessync/backend"
log "  DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME\" npx prisma migrate deploy"