#!/bin/bash

# 🔧 Fix Database Migrations and Schema
# This script fixes the missing database tables issue

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

log "🔧 Fixing database migrations and schema..."

# Navigate to backend directory
cd $APP_DIR/backend

# Set environment variable
export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

log "Database URL: $DATABASE_URL"

# Check if database exists and is accessible
log "Testing database connection..."
if ! PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    error "Cannot connect to database. Please run the database setup script first."
    exit 1
fi

log "✅ Database connection successful"

# Check current database state
log "Checking current database state..."
TABLES=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
log "Current tables in database: $TABLES"

# Reset database if needed
if [ "$TABLES" -gt 0 ]; then
    log "Database has existing tables. Resetting for clean migration..."
    PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO $DB_USER; GRANT ALL ON SCHEMA public TO public;"
fi

# Check if Prisma schema exists
if [ ! -f "prisma/schema.prisma" ]; then
    error "Prisma schema file not found at prisma/schema.prisma"
    exit 1
fi

log "✅ Prisma schema found"

# Generate Prisma client
log "Generating Prisma client..."
npx prisma generate

# Reset and push database schema (for development/fresh setup)
log "Pushing database schema..."
npx prisma db push --force-reset --accept-data-loss

# Verify tables were created
log "Verifying tables were created..."
TABLES_AFTER=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
log "Tables after migration: $TABLES_AFTER"

if [ "$TABLES_AFTER" -eq 0 ]; then
    error "No tables were created. Migration failed."
    exit 1
fi

# List created tables
log "Created tables:"
PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"

# Check if companies table exists specifically
COMPANIES_EXISTS=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies';" 2>/dev/null || echo "0")

if [ "$COMPANIES_EXISTS" -eq 0 ]; then
    error "Companies table was not created. There might be an issue with the Prisma schema."
    log "Checking Prisma schema for Company model..."
    if grep -q "model Company" prisma/schema.prisma; then
        log "Company model found in schema"
    else
        error "Company model not found in Prisma schema"
        exit 1
    fi
    exit 1
fi

log "✅ Companies table created successfully"

# Now run the seeding
log "Seeding database with demo data..."
node seed-simple.js

log "✅ Database seeding completed successfully"

# Verify seeded data
log "Verifying seeded data..."
COMPANY_COUNT=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM companies;" 2>/dev/null || echo "0")
USER_COUNT=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

log "Companies in database: $COMPANY_COUNT"
log "Users in database: $USER_COUNT"

if [ "$COMPANY_COUNT" -eq 0 ]; then
    warning "No companies were created during seeding"
else
    log "✅ Demo company created successfully"
fi

if [ "$USER_COUNT" -eq 0 ]; then
    warning "No users were created during seeding"
else
    log "✅ Demo users created successfully"
fi

# Build the application
log "Building TypeScript application..."
npx tsc --skipLibCheck

if [ -f "dist/index.js" ]; then
    log "✅ Application built successfully"
else
    error "❌ Application build failed"
    exit 1
fi

log "🎉 Database migrations and seeding completed successfully!"

# Display summary
echo ""
echo "📋 Database Summary:"
echo "  • Database: $DB_NAME"
echo "  • Tables created: $TABLES_AFTER"
echo "  • Companies: $COMPANY_COUNT"
echo "  • Users: $USER_COUNT"
echo ""
echo "🔐 Default Login (if users were created):"
echo "  • Email: admin@demo.com"
echo "  • Password: admin123"
echo ""
echo "✅ Ready to start the application with PM2!"