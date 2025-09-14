#!/bin/bash

# SalesSyncAI Quick Home Deployment
# One-command deployment to home directory

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🏠 SalesSyncAI Quick Home Deployment${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/cleanup-and-home-deploy.sh"

# Check if deployment script exists
if [ ! -f "$DEPLOY_SCRIPT" ]; then
    echo -e "${RED}❌ Deployment script not found at: $DEPLOY_SCRIPT${NC}"
    exit 1
fi

# Make sure it's executable
chmod +x "$DEPLOY_SCRIPT"

echo -e "${GREEN}📍 Installation will be in: $HOME/salessync-prod${NC}"
echo -e "${GREEN}🌐 Domain: ${DOMAIN:-localhost}${NC}"
echo ""

# Ask for confirmation
read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}🚀 Starting deployment...${NC}"
echo ""

# Run the deployment script
exec "$DEPLOY_SCRIPT"