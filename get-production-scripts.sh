#!/bin/bash

# =============================================================================
# Get SalesSync Production Scripts
# Downloads the latest deployment scripts from GitHub
# =============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

log "Downloading SalesSync production deployment scripts..."

# Download full deployment script
log "Downloading full deployment script with SSL..."
wget -O update-production-with-ssl.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/fix-prisma-seeding-validation/update-production-with-ssl.sh
chmod +x update-production-with-ssl.sh

# Download quick update script
log "Downloading quick update script..."
wget -O quick-update-production.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/fix-prisma-seeding-validation/quick-update-production.sh
chmod +x quick-update-production.sh

log "Scripts downloaded successfully!"
echo
info "📋 Available scripts:"
info "  ./update-production-with-ssl.sh    - Full deployment with SSL for SalesSync.gonxt.tech"
info "  ./quick-update-production.sh       - Quick updates for existing deployments"
echo
info "🚀 For first-time deployment, run:"
info "  sudo ./update-production-with-ssl.sh"
echo
info "🔄 For updates to existing deployment, run:"
info "  sudo ./quick-update-production.sh"
echo
log "Ready to deploy! 🎉"