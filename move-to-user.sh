#!/bin/bash

# Move SalesSync AI from /opt/salessync to user home directory
# This script safely moves the application and updates all configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Get current user
CURRENT_USER=$(whoami)
USER_HOME=$(eval echo ~$CURRENT_USER)
OLD_PATH="/opt/salessync"
NEW_PATH="$USER_HOME/SalesSyncAI"

main() {
    log_info "🚚 Moving SalesSync AI from /opt/salessync to user directory"
    echo ""
    echo "Current user: $CURRENT_USER"
    echo "User home: $USER_HOME"
    echo "Moving from: $OLD_PATH"
    echo "Moving to: $NEW_PATH"
    echo ""
    
    # Check if old directory exists
    if [[ ! -d "$OLD_PATH" ]]; then
        log_error "Source directory $OLD_PATH does not exist!"
        log_info "If the application is already in your home directory, you can skip this script."
        exit 1
    fi
    
    # Check if new directory already exists
    if [[ -d "$NEW_PATH" ]]; then
        log_warning "Target directory $NEW_PATH already exists!"
        read -p "Do you want to remove it and continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Removing existing directory..."
            rm -rf "$NEW_PATH"
        else
            log_error "Aborted by user"
            exit 1
        fi
    fi
    
    # Stop services if running
    log_info "🛑 Stopping any running services..."
    cd "$OLD_PATH"
    if [[ -f "docker-compose.yml" ]]; then
        docker-compose down 2>/dev/null || true
    fi
    
    # Move the directory
    log_info "📦 Moving directory from $OLD_PATH to $NEW_PATH..."
    sudo cp -r "$OLD_PATH" "$NEW_PATH"
    
    # Change ownership to current user
    log_info "👤 Changing ownership to $CURRENT_USER..."
    sudo chown -R $CURRENT_USER:$CURRENT_USER "$NEW_PATH"
    
    # Update file permissions
    log_info "🔐 Setting proper file permissions..."
    find "$NEW_PATH" -type f -name "*.sh" -exec chmod +x {} \;
    chmod -R 755 "$NEW_PATH"
    
    # Navigate to new directory
    cd "$NEW_PATH"
    
    # Update any hardcoded paths in configuration files
    log_info "⚙️  Updating configuration files..."
    
    # Update docker-compose.yml if it has any volume mounts with absolute paths
    if [[ -f "docker-compose.yml" ]]; then
        sed -i "s|/opt/salessync|$NEW_PATH|g" docker-compose.yml 2>/dev/null || true
    fi
    
    # Update deployment scripts
    for script in deploy*.sh fix-deployment.sh; do
        if [[ -f "$script" ]]; then
            sed -i "s|/opt/salessync|$NEW_PATH|g" "$script" 2>/dev/null || true
        fi
    done
    
    # Update nginx configuration if it has absolute paths
    if [[ -f "nginx/conf.d/default.conf" ]]; then
        sed -i "s|/opt/salessync|$NEW_PATH|g" nginx/conf.d/default.conf 2>/dev/null || true
    fi
    
    # Update any systemd service files if they exist
    if [[ -d "/etc/systemd/system" ]]; then
        for service_file in /etc/systemd/system/salessync*.service; do
            if [[ -f "$service_file" ]]; then
                log_info "Updating systemd service file: $service_file"
                sudo sed -i "s|/opt/salessync|$NEW_PATH|g" "$service_file"
            fi
        done
        
        # Reload systemd if we updated any service files
        if ls /etc/systemd/system/salessync*.service 1> /dev/null 2>&1; then
            log_info "Reloading systemd daemon..."
            sudo systemctl daemon-reload
        fi
    fi
    
    # Pull latest changes from GitHub
    log_info "📥 Pulling latest changes from GitHub..."
    git pull origin main
    
    # Set up environment
    log_info "🔧 Setting up environment..."
    if [[ -f ".env.production" ]]; then
        cp .env.production .env
    fi
    
    # Test the new setup
    log_info "🧪 Testing the new setup..."
    
    # Check if Docker is accessible
    if docker info &> /dev/null; then
        log_success "✅ Docker is accessible"
    else
        log_warning "⚠️  Docker may need to be restarted or user added to docker group"
        log_info "Run: sudo usermod -aG docker $CURRENT_USER"
        log_info "Then log out and log back in"
    fi
    
    # Start services
    log_info "🚀 Starting services in new location..."
    docker-compose up -d --build
    
    # Wait for services
    log_info "⏳ Waiting for services to start..."
    sleep 30
    
    # Check service status
    log_info "📊 Checking service status..."
    docker-compose ps
    
    # Clean up old directory (optional)
    echo ""
    log_success "✅ Move completed successfully!"
    echo ""
    log_warning "⚠️  Old directory cleanup:"
    echo "The old directory $OLD_PATH is still present."
    echo "After verifying everything works correctly, you can remove it with:"
    echo "sudo rm -rf $OLD_PATH"
    echo ""
    
    # Show new working directory
    log_info "📍 New working directory: $NEW_PATH"
    echo ""
    echo "🌐 Your application should be available at:"
    echo "   • http://ssai.gonxt.tech"
    echo "   • https://ssai.gonxt.tech"
    echo ""
    echo "📊 Management commands (run from $NEW_PATH):"
    echo "   • Check status: docker-compose ps"
    echo "   • View logs: docker-compose logs -f"
    echo "   • Restart: docker-compose restart"
    echo "   • Deploy: ./deploy-simple.sh"
    echo ""
    
    # Update shell profile to add alias
    log_info "💡 Adding convenience alias to your shell profile..."
    
    # Detect shell and add alias
    if [[ -n "$BASH_VERSION" ]]; then
        PROFILE_FILE="$USER_HOME/.bashrc"
    elif [[ -n "$ZSH_VERSION" ]]; then
        PROFILE_FILE="$USER_HOME/.zshrc"
    else
        PROFILE_FILE="$USER_HOME/.profile"
    fi
    
    # Add alias if not already present
    if ! grep -q "alias salessync=" "$PROFILE_FILE" 2>/dev/null; then
        echo "" >> "$PROFILE_FILE"
        echo "# SalesSync AI alias" >> "$PROFILE_FILE"
        echo "alias salessync='cd $NEW_PATH'" >> "$PROFILE_FILE"
        log_success "✅ Added 'salessync' alias to $PROFILE_FILE"
        log_info "Run 'source $PROFILE_FILE' or restart your terminal to use the alias"
    fi
    
    echo ""
    log_success "🎉 SalesSync AI has been successfully moved to your user directory!"
    log_info "You can now use 'salessync' command to quickly navigate to the project directory"
}

main "$@"