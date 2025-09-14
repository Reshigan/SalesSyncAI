#!/bin/bash

# Quick setup script to clone SalesSync AI directly to user directory
# Alternative to moving from /opt - just clone fresh to user home

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
PROJECT_PATH="$USER_HOME/SalesSyncAI"

main() {
    log_info "🚀 Setting up SalesSync AI in user directory"
    echo ""
    echo "Current user: $CURRENT_USER"
    echo "User home: $USER_HOME"
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
            git pull origin main
        fi
    else
        # Clone the repository
        log_info "📥 Cloning SalesSync AI repository..."
        cd "$USER_HOME"
        git clone https://github.com/Reshigan/SalesSyncAI.git
    fi
    
    # Navigate to project directory
    cd "$PROJECT_PATH"
    
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
        sudo sh get-docker.sh
        sudo usermod -aG docker $CURRENT_USER
        rm get-docker.sh
        log_warning "Please log out and log back in for Docker group changes to take effect"
    else
        log_success "✅ Docker is installed"
    fi
    
    # Check if user is in docker group
    if ! groups $CURRENT_USER | grep -q docker; then
        log_info "👤 Adding user to docker group..."
        sudo usermod -aG docker $CURRENT_USER
        log_warning "Please log out and log back in for group changes to take effect"
    else
        log_success "✅ User is in docker group"
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_info "Starting Docker daemon..."
        sudo systemctl start docker
        sudo systemctl enable docker
        sleep 5
    fi
    
    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        log_info "📦 Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        log_success "✅ Docker Compose installed"
    else
        log_success "✅ Docker Compose is available"
    fi
    
    # Add convenience alias
    log_info "💡 Adding convenience alias..."
    
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
        echo "alias salessync='cd $PROJECT_PATH'" >> "$PROFILE_FILE"
        log_success "✅ Added 'salessync' alias to $PROFILE_FILE"
    fi
    
    # Create a desktop shortcut if running on a desktop environment
    if [[ -n "$DISPLAY" ]] && [[ -d "$USER_HOME/Desktop" ]]; then
        log_info "🖥️  Creating desktop shortcut..."
        cat > "$USER_HOME/Desktop/SalesSync AI.desktop" << EOF
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
        chmod +x "$USER_HOME/Desktop/SalesSync AI.desktop"
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
    
    if ! groups $CURRENT_USER | grep -q docker || ! docker info &> /dev/null 2>&1; then
        log_warning "⚠️  Please log out and log back in for Docker permissions to take effect"
        log_warning "Then run: cd $PROJECT_PATH && ./deploy-simple.sh"
    else
        log_info "✅ Ready to deploy! Run: ./deploy-simple.sh"
    fi
}

main "$@"