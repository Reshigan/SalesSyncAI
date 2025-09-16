#!/bin/bash

# 🔧 Production Services Setup Script
# This script sets up systemd services, webhooks, and auto-startup for SalesSync

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Setting up production services for SalesSync..."

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    print_error "This script must be run as the ubuntu user"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the SalesSyncAI root directory"
    exit 1
fi

# Install systemd services
print_status "Installing systemd services..."

# Copy systemd service files
sudo cp systemd/salessync-backend.service /etc/systemd/system/
sudo cp systemd/salessync-startup.service /etc/systemd/system/

# Set correct permissions
sudo chmod 644 /etc/systemd/system/salessync-backend.service
sudo chmod 644 /etc/systemd/system/salessync-startup.service

# Reload systemd
sudo systemctl daemon-reload

print_success "Systemd services installed"

# Enable services for auto-start
print_status "Enabling services for auto-start..."
sudo systemctl enable salessync-startup.service
sudo systemctl enable postgresql
sudo systemctl enable nginx

print_success "Services enabled for auto-start"

# Setup PM2 for auto-start
print_status "Setting up PM2 for auto-start..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

print_success "PM2 configured for auto-start"

# Create log directories
print_status "Creating log directories..."
sudo mkdir -p /var/log/salessync
sudo chown ubuntu:ubuntu /var/log/salessync
sudo mkdir -p /backups/salessync
sudo chown ubuntu:ubuntu /backups/salessync

print_success "Log directories created"

# Setup logrotate for application logs
print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/salessync > /dev/null <<EOF
/var/log/salessync/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        systemctl reload salessync-startup || true
    endscript
}

/home/ubuntu/.pm2/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        pm2 reloadLogs || true
    endscript
}
EOF

print_success "Log rotation configured"

# Setup webhook endpoint (simple HTTP server)
print_status "Setting up webhook endpoint..."

# Create webhook server script
cat > scripts/webhook-server.js << 'EOF'
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');

const PORT = 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-change-this';
const DEPLOY_SCRIPT = '/home/ubuntu/SalesSyncAI/scripts/webhook-deploy.sh';

const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhook') {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            // Verify GitHub signature
            const signature = req.headers['x-hub-signature-256'];
            if (signature) {
                const expectedSignature = 'sha256=' + crypto
                    .createHmac('sha256', SECRET)
                    .update(body)
                    .digest('hex');
                
                if (signature !== expectedSignature) {
                    console.log('Invalid signature');
                    res.writeHead(401);
                    res.end('Unauthorized');
                    return;
                }
            }

            const payload = JSON.parse(body);
            
            // Only deploy on push to main branch
            if (payload.ref === 'refs/heads/main') {
                console.log('Triggering deployment...');
                
                // Set environment variables for the deployment script
                const env = {
                    ...process.env,
                    GITHUB_EVENT: 'push',
                    GITHUB_REF: payload.ref
                };
                
                exec(DEPLOY_SCRIPT, { env }, (error, stdout, stderr) => {
                    if (error) {
                        console.error('Deployment failed:', error);
                    } else {
                        console.log('Deployment completed:', stdout);
                    }
                });
                
                res.writeHead(200);
                res.end('Deployment triggered');
            } else {
                res.writeHead(200);
                res.end('Ignored non-main branch');
            }
        } catch (error) {
            console.error('Webhook error:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Webhook server listening on port ${PORT}`);
});
EOF

print_success "Webhook server created"

# Create systemd service for webhook server
sudo tee /etc/systemd/system/salessync-webhook.service > /dev/null <<EOF
[Unit]
Description=SalesSync Webhook Server
Documentation=https://github.com/Reshigan/SalesSyncAI
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/SalesSyncAI
Environment=NODE_ENV=production
Environment=WEBHOOK_SECRET=your-webhook-secret-change-this
ExecStart=/usr/bin/node scripts/webhook-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=salessync-webhook

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable salessync-webhook.service

print_success "Webhook service configured"

# Setup firewall rules for webhook
print_status "Configuring firewall for webhook..."
sudo ufw allow 9000/tcp comment "SalesSync Webhook"

print_success "Firewall configured"

# Create monitoring script
print_status "Creating monitoring script..."
cat > scripts/monitor.sh << 'EOF'
#!/bin/bash

# Simple monitoring script for SalesSync
LOG_FILE="/var/log/salessync/monitor.log"

check_service() {
    local service=$1
    local url=$2
    
    if curl -f -s "$url" > /dev/null; then
        echo "$(date): $service is healthy" >> $LOG_FILE
        return 0
    else
        echo "$(date): $service is unhealthy" >> $LOG_FILE
        return 1
    fi
}

# Check backend health
if ! check_service "Backend" "http://localhost:3001/health"; then
    echo "$(date): Restarting backend service" >> $LOG_FILE
    pm2 restart backend
fi

# Check external access
if ! check_service "External" "https://ss.gonxt.tech/health"; then
    echo "$(date): External access failed" >> $LOG_FILE
    systemctl reload nginx
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Disk usage is ${DISK_USAGE}%" >> $LOG_FILE
    # Clean old logs and backups
    find /var/log -name "*.log" -mtime +7 -delete 2>/dev/null || true
    find /backups/salessync -name "backup-*.tar.gz" -mtime +7 -delete 2>/dev/null || true
fi
EOF

chmod +x scripts/monitor.sh

# Setup cron job for monitoring
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/ubuntu/SalesSyncAI/scripts/monitor.sh") | crontab -

print_success "Monitoring configured"

# Test the startup service
print_status "Testing startup service..."
sudo systemctl start salessync-startup.service

# Wait a moment and check status
sleep 5
if sudo systemctl is-active --quiet salessync-startup.service; then
    print_success "Startup service is working"
else
    print_warning "Startup service may have issues, check logs with: journalctl -u salessync-startup.service"
fi

# Start webhook service
print_status "Starting webhook service..."
sudo systemctl start salessync-webhook.service

if sudo systemctl is-active --quiet salessync-webhook.service; then
    print_success "Webhook service is running on port 9000"
else
    print_warning "Webhook service failed to start, check logs with: journalctl -u salessync-webhook.service"
fi

print_status "Production services setup completed!"
echo ""
echo "✅ Services configured:"
echo "  • salessync-startup.service (auto-start application)"
echo "  • salessync-webhook.service (GitHub webhook handler)"
echo "  • PM2 auto-startup configured"
echo "  • Log rotation configured"
echo "  • Monitoring cron job configured"
echo ""
echo "🔧 Next steps:"
echo "  1. Update webhook secret in /etc/systemd/system/salessync-webhook.service"
echo "  2. Configure GitHub webhook to point to: http://your-server:9000/webhook"
echo "  3. Test reboot: sudo reboot"
echo ""
echo "📊 Check status with:"
echo "  • sudo systemctl status salessync-startup"
echo "  • sudo systemctl status salessync-webhook"
echo "  • pm2 status"
echo "  • journalctl -u salessync-startup -f"
echo ""
print_success "Setup completed successfully! 🚀"