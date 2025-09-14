# SalesSync AI - Live Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying SalesSync AI in a production environment. The deployment includes a complete stack with PostgreSQL database, Redis cache, Node.js backend API, and React frontend.

## Quick Start

For immediate deployment, run the automated script:

```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/live-deployment.sh | bash
```

## System Requirements

### Minimum Requirements
- **OS**: Ubuntu 20.04 LTS or newer (tested on Ubuntu 22.04)
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 5GB free disk space
- **Network**: Internet connection for package downloads

### Recommended Requirements
- **OS**: Ubuntu 22.04 LTS
- **RAM**: 4GB or more
- **Storage**: 10GB+ free disk space
- **CPU**: 2+ cores
- **Network**: Stable internet connection

## Pre-Installation Checklist

- [ ] System is running Ubuntu 20.04+ or compatible Linux distribution
- [ ] User has sudo privileges
- [ ] System is up to date (`sudo apt update && sudo apt upgrade`)
- [ ] Firewall is configured to allow necessary ports
- [ ] Domain name configured (if using custom domain)

## Manual Installation Steps

If you prefer manual installation or need to customize the deployment:

### 1. System Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget gnupg lsb-release ca-certificates \
    software-properties-common apt-transport-https build-essential \
    git unzip jq
```

### 2. Node.js Installation

```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
```

### 3. PostgreSQL Installation

```bash
# Install PostgreSQL 15
sudo apt install -y postgresql-15 postgresql-client-15 postgresql-contrib-15

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE salessync;"
sudo -u postgres psql -c "CREATE USER salessync WITH PASSWORD 'salessync123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE salessync TO salessync;"
sudo -u postgres psql -c "ALTER USER salessync CREATEDB;"
```

### 4. Redis Installation

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis
sudo sed -i 's/^# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
sudo sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf

# Start and enable Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### 5. Application Setup

```bash
# Clone repository
sudo git clone https://github.com/Reshigan/SalesSyncAI.git /opt/salessync
cd /opt/salessync
sudo chown -R $USER:$USER /opt/salessync

# Setup backend
cd /opt/salessync/backend
npm install
npm run build

# Setup frontend
cd /opt/salessync/frontend
npm install
npm run build
```

### 6. Database Configuration

Configure PostgreSQL for the application:

```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

Add these lines:
```
local   all             salessync                               trust
host    all             salessync       127.0.0.1/32            trust
```

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf
```

Ensure these settings:
```
listen_addresses = '*'
port = 5432
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### 7. Environment Configuration

Create backend environment file:

```bash
cd /opt/salessync/backend
cat > .env << EOF
DATABASE_URL="postgresql://postgres:@localhost:5432/salessync"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="24h"
PORT=12000
NODE_ENV=production
API_VERSION="v1"
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN="*"
LOG_LEVEL="info"
EOF
```

Create frontend environment file:

```bash
cd /opt/salessync/frontend
cat > .env.production << EOF
REACT_APP_API_URL=http://localhost:12000/api
REACT_APP_APP_NAME="SalesSync AI"
REACT_APP_VERSION="1.0.0"
GENERATE_SOURCEMAP=false
EOF
```

### 8. Database Migration

```bash
cd /opt/salessync/backend
npx prisma generate
npx prisma db push
```

### 9. Service Configuration

Create systemd services for automatic startup:

Backend service:
```bash
sudo tee /etc/systemd/system/salessync-backend.service > /dev/null << EOF
[Unit]
Description=SalesSync Backend API
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/salessync/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=salessync-backend

[Install]
WantedBy=multi-user.target
EOF
```

Frontend service:
```bash
# Install serve globally
sudo npm install -g serve

sudo tee /etc/systemd/system/salessync-frontend.service > /dev/null << EOF
[Unit]
Description=SalesSync Frontend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/salessync/frontend
ExecStart=/usr/bin/serve -s build -l 8080
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=salessync-frontend

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable salessync-backend salessync-frontend
sudo systemctl start salessync-backend salessync-frontend
```

### 10. Firewall Configuration

```bash
# Install and configure UFW
sudo apt install -y ufw
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow necessary ports
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp   # Frontend
sudo ufw allow 12000/tcp  # Backend API

# Enable firewall
sudo ufw --force enable
```

## Service Management

### Starting/Stopping Services

```bash
# Backend
sudo systemctl start salessync-backend
sudo systemctl stop salessync-backend
sudo systemctl restart salessync-backend

# Frontend
sudo systemctl start salessync-frontend
sudo systemctl stop salessync-frontend
sudo systemctl restart salessync-frontend

# Check status
sudo systemctl status salessync-backend
sudo systemctl status salessync-frontend
```

### Viewing Logs

```bash
# Backend logs
sudo journalctl -u salessync-backend -f

# Frontend logs
sudo journalctl -u salessync-frontend -f

# PostgreSQL logs
sudo journalctl -u postgresql -f

# Redis logs
sudo journalctl -u redis-server -f
```

## Application Access

After successful deployment:

- **Frontend Application**: http://your-server-ip:8080
- **Backend API**: http://your-server-ip:12000
- **API Documentation**: http://your-server-ip:12000/api/docs
- **Health Check**: http://your-server-ip:12000/health

## Health Checks

Verify all services are running correctly:

```bash
# Check PostgreSQL
psql -h localhost -U postgres -d salessync -c "SELECT 1;"

# Check Redis
redis-cli ping

# Check Backend API
curl http://localhost:12000/health

# Check Frontend
curl http://localhost:8080
```

## Production Considerations

### Security

1. **Change Default Passwords**: Update all default passwords in production
2. **JWT Secret**: Use a strong, unique JWT secret
3. **Firewall**: Restrict access to necessary ports only
4. **SSL/TLS**: Configure HTTPS with valid certificates
5. **Database Security**: Restrict database access and use strong passwords

### Performance

1. **Resource Monitoring**: Monitor CPU, memory, and disk usage
2. **Database Optimization**: Configure PostgreSQL for your workload
3. **Redis Configuration**: Tune Redis memory settings
4. **Load Balancing**: Consider load balancing for high traffic

### Backup Strategy

1. **Database Backups**: Regular PostgreSQL backups
2. **Application Backups**: Backup application files and configurations
3. **Automated Backups**: Set up automated backup schedules

### Monitoring

1. **Application Logs**: Monitor application logs for errors
2. **System Metrics**: Monitor system resources
3. **Health Checks**: Implement automated health monitoring
4. **Alerting**: Set up alerts for critical issues

## Reverse Proxy Setup (Nginx)

For production deployment with custom domain:

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:12000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL Certificate Setup (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   sudo lsof -i :8080
   sudo lsof -i :12000
   ```

2. **Database Connection Issues**
   ```bash
   sudo systemctl status postgresql
   sudo journalctl -u postgresql -f
   ```

3. **Service Won't Start**
   ```bash
   sudo systemctl status salessync-backend
   sudo journalctl -u salessync-backend -f
   ```

4. **Permission Issues**
   ```bash
   sudo chown -R $USER:$USER /opt/salessync
   ```

### Log Locations

- Application logs: `sudo journalctl -u salessync-backend -f`
- PostgreSQL logs: `/var/log/postgresql/`
- Nginx logs: `/var/log/nginx/`
- System logs: `/var/log/syslog`

### Performance Issues

1. **High Memory Usage**: Check Redis and PostgreSQL memory settings
2. **Slow Database Queries**: Enable PostgreSQL query logging
3. **High CPU Usage**: Monitor Node.js processes

## Updates and Maintenance

### Updating the Application

```bash
cd /opt/salessync
git pull origin main

# Update backend
cd backend
npm install
npm run build
sudo systemctl restart salessync-backend

# Update frontend
cd ../frontend
npm install
npm run build
sudo systemctl restart salessync-frontend
```

### Database Maintenance

```bash
# Vacuum database
sudo -u postgres psql -d salessync -c "VACUUM ANALYZE;"

# Check database size
sudo -u postgres psql -d salessync -c "SELECT pg_size_pretty(pg_database_size('salessync'));"
```

## Support

For issues and support:

1. Check the troubleshooting section above
2. Review application logs
3. Check system resources
4. Verify all services are running
5. Test network connectivity

## Version Information

- **Script Version**: 1.0.0
- **Last Updated**: 2025-09-14
- **Tested On**: Ubuntu 22.04 LTS
- **Node.js Version**: 18.x LTS
- **PostgreSQL Version**: 15
- **Redis Version**: Latest stable

---

**Note**: This deployment guide is based on successful testing and deployment. Always test in a staging environment before deploying to production.