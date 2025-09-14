#!/bin/bash

# Fixed setup script for SalesSync AI in user directory
# This version handles permission issues properly

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

# Detect if running as root and get the actual user
if [[ $EUID -eq 0 ]]; then
    # Running as root, get the original user
    if [[ -n "$SUDO_USER" ]]; then
        ACTUAL_USER="$SUDO_USER"
        ACTUAL_HOME=$(eval echo ~$SUDO_USER)
    else
        log_error "This script should not be run as root directly."
        log_error "Please run as regular user: ./setup-user-fixed.sh"
        exit 1
    fi
else
    # Running as regular user
    ACTUAL_USER=$(whoami)
    ACTUAL_HOME="$HOME"
fi

PROJECT_PATH="$ACTUAL_HOME/SalesSyncAI"

main() {
    log_info "🚀 Setting up SalesSync AI in user directory"
    echo ""
    echo "Actual user: $ACTUAL_USER"
    echo "User home: $ACTUAL_HOME"
    echo "Project path: $PROJECT_PATH"
    echo ""
    
    # Check if directory already exists
    if [[ -d "$PROJECT_PATH" ]]; then
        log_warning "Directory $PROJECT_PATH already exists!"
        read -p "Do you want to remove it and clone fresh? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Removing existing directory..."
            rm -rf "$PROJECT_PATH"
        else
            log_info "Using existing directory..."
            cd "$PROJECT_PATH"
            # Run git pull as the actual user
            if [[ $EUID -eq 0 ]]; then
                sudo -u "$ACTUAL_USER" git pull origin main
            else
                git pull origin main
            fi
        fi
    fi
    
    # Clone if directory doesn't exist
    if [[ ! -d "$PROJECT_PATH" ]]; then
        log_info "📥 Cloning SalesSync AI repository..."
        cd "$ACTUAL_HOME"
        
        # Clone as the actual user
        if [[ $EUID -eq 0 ]]; then
            sudo -u "$ACTUAL_USER" git clone https://github.com/Reshigan/SalesSyncAI.git
        else
            git clone https://github.com/Reshigan/SalesSyncAI.git
        fi
    fi
    
    # Navigate to project directory
    cd "$PROJECT_PATH"
    
    # Fix ownership if running as root
    if [[ $EUID -eq 0 ]]; then
        log_info "🔐 Fixing ownership for user $ACTUAL_USER..."
        chown -R "$ACTUAL_USER:$ACTUAL_USER" "$PROJECT_PATH"
    fi
    
    # Set proper permissions
    log_info "🔐 Setting proper file permissions..."
    find . -type f -name "*.sh" -exec chmod +x {} \;
    
    # Set up environment
    log_info "⚙️  Setting up production environment..."
    if [[ -f ".env.production" ]]; then
        cp .env.production .env
        log_success "✅ Production environment configured"
    else
        log_warning "⚠️  .env.production not found, you may need to configure environment variables"
    fi
    
    # Check Docker installation
    log_info "🐳 Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        log_warning "Docker is not installed. Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        usermod -aG docker "$ACTUAL_USER"
        rm get-docker.sh
        log_warning "Docker installed. User $ACTUAL_USER added to docker group."
    else
        log_success "✅ Docker is installed"
    fi
    
    # Check if user is in docker group
    if ! groups "$ACTUAL_USER" | grep -q docker; then
        log_info "👤 Adding user $ACTUAL_USER to docker group..."
        usermod -aG docker "$ACTUAL_USER"
        log_warning "User added to docker group. Please log out and log back in for changes to take effect."
    else
        log_success "✅ User $ACTUAL_USER is in docker group"
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_info "Starting Docker daemon..."
        systemctl start docker
        systemctl enable docker
        sleep 5
    fi
    
    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        log_info "📦 Installing Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        log_success "✅ Docker Compose installed"
    else
        log_success "✅ Docker Compose is available"
    fi
    
    # Add convenience alias to user's profile
    log_info "💡 Adding convenience alias..."
    
    # Detect shell and add alias
    USER_SHELL=$(getent passwd "$ACTUAL_USER" | cut -d: -f7)
    if [[ "$USER_SHELL" == *"bash"* ]]; then
        PROFILE_FILE="$ACTUAL_HOME/.bashrc"
    elif [[ "$USER_SHELL" == *"zsh"* ]]; then
        PROFILE_FILE="$ACTUAL_HOME/.zshrc"
    else
        PROFILE_FILE="$ACTUAL_HOME/.profile"
    fi
    
    # Add alias if not already present
    if ! grep -q "alias salessync=" "$PROFILE_FILE" 2>/dev/null; then
        echo "" >> "$PROFILE_FILE"
        echo "# SalesSync AI alias" >> "$PROFILE_FILE"
        echo "alias salessync='cd $PROJECT_PATH'" >> "$PROFILE_FILE"
        # Fix ownership of profile file
        if [[ $EUID -eq 0 ]]; then
            chown "$ACTUAL_USER:$ACTUAL_USER" "$PROFILE_FILE"
        fi
        log_success "✅ Added 'salessync' alias to $PROFILE_FILE"
    fi
    
    # Create a desktop shortcut if running on a desktop environment
    if [[ -d "$ACTUAL_HOME/Desktop" ]]; then
        log_info "🖥️  Creating desktop shortcut..."
        cat > "$ACTUAL_HOME/Desktop/SalesSync AI.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=SalesSync AI
Comment=SalesSync AI Management
Exec=gnome-terminal --working-directory=$PROJECT_PATH
Icon=applications-internet
Terminal=true
Categories=Development;
EOF
        chmod +x "$ACTUAL_HOME/Desktop/SalesSync AI.desktop"
        # Fix ownership
        if [[ $EUID -eq 0 ]]; then
            chown "$ACTUAL_USER:$ACTUAL_USER" "$ACTUAL_HOME/Desktop/SalesSync AI.desktop"
        fi
        log_success "✅ Desktop shortcut created"
    fi
    
    echo ""
    log_success "🎉 SalesSync AI setup completed in user directory!"
    echo ""
    echo "📍 Project location: $PROJECT_PATH"
    echo ""
    echo "🚀 To deploy the application:"
    echo "   cd $PROJECT_PATH"
    echo "   ./deploy-simple.sh"
    echo ""
    echo "💡 Quick access:"
    echo "   • Use 'salessync' command to navigate to project (after restarting terminal)"
    echo "   • Or bookmark: cd $PROJECT_PATH"
    echo ""
    echo "📊 Management commands:"
    echo "   • Deploy: ./deploy-simple.sh"
    echo "   • Status: docker-compose ps"
    echo "   • Logs: docker-compose logs -f"
    echo "   • Restart: docker-compose restart"
    echo "   • Stop: docker-compose down"
    echo ""
    echo "🌐 Application URLs (after deployment):"
    echo "   • http://ssai.gonxt.tech"
    echo "   • https://ssai.gonxt.tech"
    echo ""
    
    # Check if user needs to log out/in for docker group
    if ! sudo -u "$ACTUAL_USER" groups | grep -q docker 2>/dev/null; then
        log_warning "⚠️  Please log out and log back in for Docker group changes to take effect"
        log_warning "Then run as user $ACTUAL_USER: cd $PROJECT_PATH && ./deploy-simple.sh"
    else
        log_info "✅ Ready to deploy! Switch to user $ACTUAL_USER and run: cd $PROJECT_PATH && ./deploy-simple.sh"
    fi
    
    # Final ownership fix
    if [[ $EUID -eq 0 ]]; then
        log_info "🔧 Final ownership fix..."
        chown -R "$ACTUAL_USER:$ACTUAL_USER" "$PROJECT_PATH"
    fi
}

main "$@"