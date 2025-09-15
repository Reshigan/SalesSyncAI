#!/bin/bash

# SalesSync Deployment Menu
# Choose your deployment method

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Display header
echo -e "${CYAN}================================${NC}"
echo -e "${WHITE}   SalesSync Deployment Menu    ${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo -e "${RED}Error: Please run this script from the SalesSync root directory${NC}"
    exit 1
fi

# Display options
echo -e "${BLUE}Choose your deployment method:${NC}"
echo ""
echo -e "${GREEN}1.${NC} ${WHITE}Complete Production Deployment${NC} (Recommended)"
echo -e "   • Installs all dependencies automatically"
echo -e "   • Creates secure environment configuration"
echo -e "   • Deploys all services with monitoring"
echo -e "   • Includes database setup and demo data"
echo ""
echo -e "${GREEN}2.${NC} ${WHITE}Quick Fix Deployment${NC}"
echo -e "   • Fixes common Docker build issues"
echo -e "   • Uses existing configuration"
echo -e "   • Faster deployment for known working setups"
echo ""
echo -e "${GREEN}3.${NC} ${WHITE}Clean System First${NC}"
echo -e "   • Removes all existing Docker containers/images"
echo -e "   • Cleans up conflicting services"
echo -e "   • Prepares system for fresh deployment"
echo ""
echo -e "${GREEN}4.${NC} ${WHITE}Manual Docker Compose${NC}"
echo -e "   • Use existing docker-compose files"
echo -e "   • For advanced users who want control"
echo ""
echo -e "${GREEN}5.${NC} ${WHITE}View Deployment Status${NC}"
echo -e "   • Check currently running services"
echo -e "   • View logs and health status"
echo ""
echo -e "${YELLOW}0.${NC} Exit"
echo ""

# Get user choice
read -p "Enter your choice (0-5): " choice

case $choice in
    1)
        echo -e "${BLUE}Starting Complete Production Deployment...${NC}"
        echo ""
        echo -e "${YELLOW}This will:${NC}"
        echo "• Install Docker and Docker Compose if needed"
        echo "• Create secure environment configuration"
        echo "• Build and deploy all services"
        echo "• Set up database with demo data"
        echo ""
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ./deploy-production.sh
        else
            echo "Deployment cancelled."
        fi
        ;;
    2)
        echo -e "${BLUE}Starting Quick Fix Deployment...${NC}"
        echo ""
        echo -e "${YELLOW}This will:${NC}"
        echo "• Fix common npm and Docker issues"
        echo "• Use fallback installation methods"
        echo "• Deploy with existing configuration"
        echo ""
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ./deploy-fix.sh
        else
            echo "Deployment cancelled."
        fi
        ;;
    3)
        echo -e "${BLUE}Starting System Cleanup...${NC}"
        echo ""
        echo -e "${RED}WARNING: This will remove ALL Docker containers and images!${NC}"
        echo -e "${YELLOW}This will:${NC}"
        echo "• Stop and remove all Docker containers"
        echo "• Remove all Docker images and volumes"
        echo "• Stop conflicting system services"
        echo "• Clean application directories"
        echo ""
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ./cleanup-system.sh
            echo ""
            echo -e "${GREEN}System cleaned! Now run option 1 for fresh deployment.${NC}"
        else
            echo "Cleanup cancelled."
        fi
        ;;
    4)
        echo -e "${BLUE}Manual Docker Compose Deployment${NC}"
        echo ""
        echo "Available docker-compose files:"
        ls -la docker-compose*.yml | awk '{print "  • " $9}'
        echo ""
        echo "Recommended commands:"
        echo -e "${CYAN}# For complete production deployment:${NC}"
        echo "docker-compose -f docker-compose.full.yml up -d --build"
        echo ""
        echo -e "${CYAN}# For simple deployment:${NC}"
        echo "docker-compose up -d --build"
        echo ""
        echo -e "${CYAN}# To view logs:${NC}"
        echo "docker-compose -f docker-compose.full.yml logs -f"
        echo ""
        read -p "Run complete production deployment now? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Creating environment file..."
            if [ ! -f ".env" ]; then
                cp .env.template .env
                echo -e "${YELLOW}Please edit .env file with secure passwords before deployment!${NC}"
                echo "Press Enter to continue after editing .env file..."
                read
            fi
            echo "Starting deployment..."
            docker-compose -f docker-compose.full.yml up -d --build
        fi
        ;;
    5)
        echo -e "${BLUE}Deployment Status${NC}"
        echo ""
        
        # Check if Docker is running
        if ! docker info &> /dev/null; then
            echo -e "${RED}Docker is not running${NC}"
            exit 1
        fi
        
        # Check for running containers
        echo -e "${CYAN}Running Containers:${NC}"
        if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -q salessync; then
            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep salessync
        else
            echo "No SalesSync containers running"
        fi
        echo ""
        
        # Test endpoints if containers are running
        if docker ps | grep -q salessync; then
            echo -e "${CYAN}Health Checks:${NC}"
            
            # Test frontend
            if curl -f -s http://localhost/health &>/dev/null; then
                echo -e "Frontend: ${GREEN}✅ Healthy${NC}"
            else
                echo -e "Frontend: ${RED}❌ Not responding${NC}"
            fi
            
            # Test API
            if curl -f -s http://localhost/api/health &>/dev/null; then
                echo -e "API: ${GREEN}✅ Healthy${NC}"
            else
                echo -e "API: ${RED}❌ Not responding${NC}"
            fi
            
            echo ""
            echo -e "${CYAN}Access URLs:${NC}"
            echo "Frontend: http://localhost"
            echo "API: http://localhost/api"
            echo "Health: http://localhost/health"
            echo ""
            echo -e "${CYAN}Default Login:${NC}"
            echo "Email: admin@salessync.com"
            echo "Password: Admin123!"
        fi
        
        echo ""
        echo -e "${CYAN}Management Commands:${NC}"
        echo "View logs: docker-compose -f docker-compose.full.yml logs -f"
        echo "Restart: docker-compose -f docker-compose.full.yml restart"
        echo "Stop: docker-compose -f docker-compose.full.yml down"
        ;;
    0)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice. Please select 0-5.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"