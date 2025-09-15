#!/bin/bash

# SalesSync Complete System Cleanup Script
# Removes all Docker containers, images, volumes, and conflicting services
# Prepares system for fresh production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

log_header() {
    echo -e "${CYAN}================================${NC}"
    echo -e "${WHITE}$1${NC}"
    echo -e "${CYAN}================================${NC}"
}

# Check if running with appropriate permissions
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root. This is acceptable for system cleanup."
    else
        log_info "Running as regular user. Will use sudo when needed."
        # Test sudo access
        if ! sudo -n true 2>/dev/null; then
            log_warning "This script requires sudo access for system cleanup."
            echo "Please enter your password when prompted."
        fi
    fi
}

# Stop all running containers
stop_all_containers() {
    log_step "Stopping all running Docker containers..."
    
    # Get all running container IDs
    RUNNING_CONTAINERS=$(docker ps -q 2>/dev/null || true)
    
    if [ -n "$RUNNING_CONTAINERS" ]; then
        log_info "Found running containers. Stopping them..."
        docker stop $RUNNING_CONTAINERS 2>/dev/null || true
        log_success "All containers stopped"
    else
        log_info "No running containers found"
    fi
}

# Remove all containers
remove_all_containers() {
    log_step "Removing all Docker containers..."
    
    # Get all container IDs
    ALL_CONTAINERS=$(docker ps -aq 2>/dev/null || true)
    
    if [ -n "$ALL_CONTAINERS" ]; then
        log_info "Found containers. Removing them..."
        docker rm -f $ALL_CONTAINERS 2>/dev/null || true
        log_success "All containers removed"
    else
        log_info "No containers found"
    fi
}

# Remove all images
remove_all_images() {
    log_step "Removing all Docker images..."
    
    # Get all image IDs
    ALL_IMAGES=$(docker images -aq 2>/dev/null || true)
    
    if [ -n "$ALL_IMAGES" ]; then
        log_info "Found images. Removing them..."
        docker rmi -f $ALL_IMAGES 2>/dev/null || true
        log_success "All images removed"
    else
        log_info "No images found"
    fi
}

# Remove all volumes
remove_all_volumes() {
    log_step "Removing all Docker volumes..."
    
    # Get all volume names
    ALL_VOLUMES=$(docker volume ls -q 2>/dev/null || true)
    
    if [ -n "$ALL_VOLUMES" ]; then
        log_info "Found volumes. Removing them..."
        docker volume rm $ALL_VOLUMES 2>/dev/null || true
        log_success "All volumes removed"
    else
        log_info "No volumes found"
    fi
}

# Remove all networks (except default ones)
remove_custom_networks() {
    log_step "Removing custom Docker networks..."
    
    # Get custom network IDs (exclude default networks)
    CUSTOM_NETWORKS=$(docker network ls --filter type=custom -q 2>/dev/null || true)
    
    if [ -n "$CUSTOM_NETWORKS" ]; then
        log_info "Found custom networks. Removing them..."
        docker network rm $CUSTOM_NETWORKS 2>/dev/null || true
        log_success "Custom networks removed"
    else
        log_info "No custom networks found"
    fi
}

# Clean Docker system
clean_docker_system() {
    log_step "Performing Docker system cleanup..."
    
    # Prune everything
    docker system prune -af --volumes 2>/dev/null || true
    
    log_success "Docker system cleaned"
}

# Stop conflicting system services
stop_conflicting_services() {
    log_step "Stopping conflicting system services..."
    
    # List of services that might conflict
    SERVICES=("apache2" "httpd" "nginx" "postgresql" "mysql" "mariadb" "redis-server" "redis")
    
    for service in "${SERVICES[@]}"; do
        if systemctl is-active --quiet $service 2>/dev/null; then
            log_info "Stopping $service..."
            sudo systemctl stop $service 2>/dev/null || true
            sudo systemctl disable $service 2>/dev/null || true
        fi
    done
    
    log_success "Conflicting services stopped"
}

# Kill processes on common ports
kill_port_processes() {
    log_step "Killing processes on common ports..."
    
    # Common ports used by the application
    PORTS=(80 443 3000 3001 5432 5433 6379 6380 8080 8081)
    
    for port in "${PORTS[@]}"; do
        # Find processes using the port
        PIDS=$(lsof -ti:$port 2>/dev/null || true)
        
        if [ -n "$PIDS" ]; then
            log_info "Killing processes on port $port..."
            sudo kill -9 $PIDS 2>/dev/null || true
        fi
    done
    
    log_success "Port processes cleared"
}

# Remove application directories (optional)
cleanup_app_directories() {
    log_step "Cleaning up application directories..."
    
    # Common application directories
    DIRS=(
        "/opt/salessync"
        "/var/lib/salessync"
        "/var/log/salessync"
        "/tmp/salessync*"
    )
    
    for dir in "${DIRS[@]}"; do
        if [ -d "$dir" ] || [ -f "$dir" ]; then
            log_info "Removing $dir..."
            sudo rm -rf $dir 2>/dev/null || true
        fi
    done
    
    log_success "Application directories cleaned"
}

# Clean npm and node caches
clean_node_caches() {
    log_step "Cleaning Node.js and npm caches..."
    
    # Clean npm cache
    npm cache clean --force 2>/dev/null || true
    
    # Clean yarn cache if yarn is installed
    if command -v yarn &> /dev/null; then
        yarn cache clean 2>/dev/null || true
    fi
    
    # Remove node_modules in current directory
    if [ -d "node_modules" ]; then
        log_info "Removing local node_modules..."
        rm -rf node_modules
    fi
    
    # Remove node_modules in subdirectories
    find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
    
    log_success "Node.js caches cleaned"
}

# Remove package-lock files
clean_lock_files() {
    log_step "Cleaning lock files..."
    
    # Remove package-lock.json files
    find . -name "package-lock.json" -type f -delete 2>/dev/null || true
    
    # Remove yarn.lock files
    find . -name "yarn.lock" -type f -delete 2>/dev/null || true
    
    log_success "Lock files cleaned"
}

# Main cleanup function
main() {
    log_header "SalesSync Complete System Cleanup"
    
    echo "This script will:"
    echo "• Stop and remove all Docker containers"
    echo "• Remove all Docker images and volumes"
    echo "• Stop conflicting system services"
    echo "• Kill processes on common ports"
    echo "• Clean application directories"
    echo "• Clean Node.js caches"
    echo ""
    
    read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled by user"
        exit 0
    fi
    
    log_info "Starting complete system cleanup..."
    
    # Check permissions
    check_permissions
    
    # Docker cleanup
    if command -v docker &> /dev/null; then
        log_header "Docker Cleanup"
        stop_all_containers
        remove_all_containers
        remove_all_images
        remove_all_volumes
        remove_custom_networks
        clean_docker_system
    else
        log_warning "Docker not found. Skipping Docker cleanup."
    fi
    
    # System services cleanup
    log_header "System Services Cleanup"
    stop_conflicting_services
    kill_port_processes
    
    # Application cleanup
    log_header "Application Cleanup"
    cleanup_app_directories
    
    # Node.js cleanup
    if command -v node &> /dev/null; then
        log_header "Node.js Cleanup"
        clean_node_caches
        clean_lock_files
    else
        log_warning "Node.js not found. Skipping Node.js cleanup."
    fi
    
    log_header "Cleanup Complete"
    log_success "🎉 System cleanup completed successfully!"
    log_info "Your system is now ready for fresh deployment."
    
    echo ""
    echo "Next steps:"
    echo "1. Run the production deployment script"
    echo "2. Or manually install Docker if not present"
    echo "3. Deploy the application using docker-compose"
    echo ""
}

# Run main function
main "$@"