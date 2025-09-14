#!/bin/bash

# SalesSync Deployment Monitor Script
# Monitors deployment progress and provides status updates

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 SalesSync Deployment Monitor${NC}"
echo "Monitoring deployment progress..."
echo ""

# Function to check service status
check_service() {
    local service=$1
    if systemctl is-active --quiet $service; then
        echo -e "${GREEN}✅ $service: Running${NC}"
        return 0
    else
        echo -e "${YELLOW}⏳ $service: Not running yet${NC}"
        return 1
    fi
}

# Function to check database connection
check_database() {
    if sudo -u postgres psql -c '\l' | grep -q salessync_production; then
        echo -e "${GREEN}✅ Database: Created successfully${NC}"
        return 0
    else
        echo -e "${YELLOW}⏳ Database: Still setting up${NC}"
        return 1
    fi
}

# Function to check if processes are running
check_processes() {
    echo -e "${BLUE}🔍 Checking running processes:${NC}"
    
    if pgrep -f "npm" > /dev/null; then
        echo -e "${YELLOW}⏳ NPM processes running (installing packages)${NC}"
    fi
    
    if pgrep -f "prisma" > /dev/null; then
        echo -e "${YELLOW}⏳ Prisma processes running (database setup)${NC}"
    fi
    
    if pgrep -f "node" > /dev/null; then
        echo -e "${GREEN}✅ Node.js processes running${NC}"
    fi
    
    if pgrep -f "postgres" > /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL processes running${NC}"
    fi
}

# Function to check disk space
check_disk_space() {
    local available=$(df / | tail -1 | awk '{print $4}')
    local available_gb=$((available / 1024 / 1024))
    
    if [ $available_gb -gt 2 ]; then
        echo -e "${GREEN}✅ Disk space: ${available_gb}GB available${NC}"
    else
        echo -e "${RED}⚠️ Disk space: Only ${available_gb}GB available${NC}"
    fi
}

# Function to show deployment progress
show_progress() {
    echo -e "${BLUE}📈 Deployment Progress:${NC}"
    
    # Check if Node.js is installed
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✅ Node.js $(node -v) installed${NC}"
    else
        echo -e "${YELLOW}⏳ Node.js installation pending${NC}"
    fi
    
    # Check if PostgreSQL is installed
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL installed${NC}"
        check_database
    else
        echo -e "${YELLOW}⏳ PostgreSQL installation pending${NC}"
    fi
    
    # Check if Redis is installed
    if command -v redis-server &> /dev/null; then
        echo -e "${GREEN}✅ Redis installed${NC}"
        check_service redis-server
    else
        echo -e "${YELLOW}⏳ Redis installation pending${NC}"
    fi
    
    # Check if Nginx is installed
    if command -v nginx &> /dev/null; then
        echo -e "${GREEN}✅ Nginx installed${NC}"
        check_service nginx
    else
        echo -e "${YELLOW}⏳ Nginx installation pending${NC}"
    fi
    
    # Check if SalesSync directory exists
    if [ -d "/opt/salessync" ]; then
        echo -e "${GREEN}✅ SalesSync code downloaded${NC}"
        
        # Check if backend is built
        if [ -d "/opt/salessync/backend/dist" ]; then
            echo -e "${GREEN}✅ Backend built successfully${NC}"
        else
            echo -e "${YELLOW}⏳ Backend build in progress${NC}"
        fi
        
        # Check if frontend is built
        if [ -d "/opt/salessync/frontend-web/build" ]; then
            echo -e "${GREEN}✅ Frontend built successfully${NC}"
        else
            echo -e "${YELLOW}⏳ Frontend build in progress${NC}"
        fi
    else
        echo -e "${YELLOW}⏳ SalesSync code download pending${NC}"
    fi
}

# Function to check if deployment is stuck
check_if_stuck() {
    local stuck_processes=()
    
    # Check for long-running npm processes
    if pgrep -f "npm" > /dev/null; then
        local npm_duration=$(ps -o etime= -p $(pgrep -f "npm" | head -1) 2>/dev/null | tr -d ' ')
        if [[ $npm_duration =~ ^[0-9]{2,}:[0-9]{2}$ ]]; then
            stuck_processes+=("NPM install running for $npm_duration")
        fi
    fi
    
    # Check for long-running database operations
    if pgrep -f "psql\|postgres" > /dev/null; then
        local db_processes=$(pgrep -f "psql\|postgres" | wc -l)
        if [ $db_processes -gt 5 ]; then
            stuck_processes+=("Multiple database processes ($db_processes)")
        fi
    fi
    
    if [ ${#stuck_processes[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️ Potentially stuck processes detected:${NC}"
        for process in "${stuck_processes[@]}"; do
            echo -e "${YELLOW}   - $process${NC}"
        done
        echo ""
        echo -e "${BLUE}💡 If deployment seems stuck for >10 minutes, you can:${NC}"
        echo "   1. Wait a bit longer (npm installs can take time)"
        echo "   2. Check logs: tail -f /var/log/syslog"
        echo "   3. Kill and restart: sudo pkill -f npm && rerun deployment"
    fi
}

# Main monitoring loop
while true; do
    clear
    echo -e "${BLUE}📊 SalesSync Deployment Monitor - $(date)${NC}"
    echo "=============================================="
    echo ""
    
    check_disk_space
    echo ""
    
    show_progress
    echo ""
    
    check_processes
    echo ""
    
    check_if_stuck
    echo ""
    
    # Check if deployment is complete
    if [ -f "/opt/salessync/backend/dist/index.js" ] && [ -d "/var/www/html/static" ]; then
        echo -e "${GREEN}🎉 DEPLOYMENT APPEARS COMPLETE!${NC}"
        echo -e "${GREEN}✅ Backend built and ready${NC}"
        echo -e "${GREEN}✅ Frontend deployed to web server${NC}"
        echo ""
        echo -e "${BLUE}🌐 Try accessing: https://SSAI.gonxt.tech${NC}"
        break
    fi
    
    echo -e "${BLUE}⏳ Deployment still in progress... (refreshing in 30 seconds)${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"
    
    sleep 30
done

echo ""
echo -e "${GREEN}✅ Monitoring complete!${NC}"