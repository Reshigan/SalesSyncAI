# 🚀 CI/CD Pipeline & Auto-Deployment Setup

This document describes the complete CI/CD pipeline and auto-deployment system for SalesSync AI.

## 📋 Overview

The system provides:
- ✅ **Automatic deployment** on GitHub main branch merges
- ✅ **Application auto-start** on server reboot
- ✅ **Health monitoring** and automatic recovery
- ✅ **Webhook-based deployments** from GitHub
- ✅ **Complete rebuild** of the entire application
- ✅ **Backup and rollback** capabilities

## 🔧 Components

### 1. GitHub Actions Pipeline
**File**: `.github/workflows/deploy-production.yml`

**Triggers**:
- Push to `main` branch
- Pull request merged to `main` branch

**Features**:
- Builds and tests both frontend and backend
- Deploys to production server via SSH
- Runs comprehensive health checks
- Automatic rollback on failure
- Slack notifications on failure

### 2. Systemd Services

#### salessync-startup.service
- **Purpose**: Ensures application starts on server reboot
- **Features**: Waits for PostgreSQL, starts PM2 processes, runs health checks
- **Location**: `/etc/systemd/system/salessync-startup.service`

#### salessync-webhook.service
- **Purpose**: Handles GitHub webhook deployments
- **Features**: Secure webhook validation, automatic deployment trigger
- **Location**: `/etc/systemd/system/salessync-webhook.service`

### 3. Deployment Scripts

#### startup.sh
- **Purpose**: Application startup sequence
- **Features**: Database checks, service startup, health validation
- **Location**: `scripts/startup.sh`

#### webhook-deploy.sh
- **Purpose**: Webhook-triggered deployment
- **Features**: Full rebuild, backup creation, health checks
- **Location**: `scripts/webhook-deploy.sh`

#### setup-production-services.sh
- **Purpose**: One-time setup of all services
- **Features**: Installs systemd services, configures auto-start, sets up monitoring
- **Location**: `scripts/setup-production-services.sh`

## 🚀 Setup Instructions

### Step 1: Configure GitHub Secrets

Add these secrets to your GitHub repository:

```
PRODUCTION_HOST=13.246.34.207
PRODUCTION_USER=ubuntu
PRODUCTION_PASSWORD=your-server-password
SLACK_WEBHOOK_URL=your-slack-webhook-url (optional)
```

### Step 2: Run Setup Script on Production Server

SSH into your production server and run:

```bash
cd /home/ubuntu/SalesSyncAI
./scripts/setup-production-services.sh
```

This will:
- Install systemd services
- Configure auto-start on reboot
- Set up webhook server
- Configure monitoring and log rotation

### Step 3: Configure GitHub Webhook (Optional)

1. Go to your GitHub repository settings
2. Navigate to "Webhooks"
3. Add webhook with:
   - **URL**: `http://13.246.34.207:9000/webhook`
   - **Content type**: `application/json`
   - **Secret**: Update in `/etc/systemd/system/salessync-webhook.service`
   - **Events**: Just push events

### Step 4: Test the Setup

1. **Test auto-start**: `sudo reboot` (application should start automatically)
2. **Test deployment**: Push to main branch or merge a PR
3. **Test webhook**: Make a commit to main branch

## 🔄 Deployment Process

### Automatic Deployment (GitHub Actions)
1. Code pushed/merged to main branch
2. GitHub Actions triggers
3. Builds and tests application
4. SSH into production server
5. Stops services gracefully
6. Creates backup
7. Pulls latest code
8. Rebuilds entire application
9. Updates database schema and seeds data
10. Restarts all services
11. Runs comprehensive health checks
12. Reports success/failure

### Webhook Deployment
1. GitHub sends webhook on push to main
2. Webhook server validates signature
3. Triggers deployment script
4. Same process as GitHub Actions but server-side

### Manual Deployment
```bash
cd /home/ubuntu/SalesSyncAI
./DEPLOY_TO_PRODUCTION.sh
```

## 🔍 Monitoring & Health Checks

### Automatic Health Checks
- **Backend health**: `http://localhost:3001/health`
- **API health**: `http://localhost:3001/api/health`
- **Login functionality**: Tests with demo user
- **External access**: `https://ss.gonxt.tech/health`

### Monitoring Script
- **Location**: `scripts/monitor.sh`
- **Frequency**: Every 5 minutes (cron job)
- **Features**: Service health checks, disk space monitoring, automatic recovery

### Log Files
- **Application logs**: `/var/log/salessync/`
- **PM2 logs**: `/home/ubuntu/.pm2/logs/`
- **Deployment logs**: `/var/log/salessync-deploy.log`
- **System logs**: `journalctl -u salessync-startup`

## 🛠️ Service Management

### Check Service Status
```bash
# Application services
pm2 status
sudo systemctl status salessync-startup
sudo systemctl status salessync-webhook

# System services
sudo systemctl status nginx
sudo systemctl status postgresql
```

### View Logs
```bash
# Application logs
pm2 logs backend
journalctl -u salessync-startup -f
journalctl -u salessync-webhook -f

# Deployment logs
tail -f /var/log/salessync-deploy.log
```

### Manual Service Control
```bash
# Restart application
sudo systemctl restart salessync-startup

# Restart webhook server
sudo systemctl restart salessync-webhook

# Restart PM2 processes
pm2 restart all
```

## 🔒 Security Features

### GitHub Actions Security
- Uses SSH with password authentication
- Validates server connection before deployment
- Automatic rollback on health check failure

### Webhook Security
- HMAC signature validation
- Secret-based authentication
- IP filtering (optional)
- Rate limiting (built-in)

### System Security
- Services run as non-root user (ubuntu)
- Restricted file permissions
- Firewall rules for webhook port
- Log rotation to prevent disk filling

## 🚨 Troubleshooting

### Deployment Fails
1. Check GitHub Actions logs
2. SSH into server and check: `journalctl -u salessync-startup -f`
3. Check PM2 logs: `pm2 logs backend`
4. Verify database connection: `psql -h localhost -U salessync -d salessync -c "SELECT 1;"`

### Application Won't Start on Reboot
1. Check systemd service: `sudo systemctl status salessync-startup`
2. Check startup script logs: `journalctl -u salessync-startup -f`
3. Manually run startup script: `./scripts/startup.sh`

### Webhook Not Working
1. Check webhook service: `sudo systemctl status salessync-webhook`
2. Check webhook logs: `journalctl -u salessync-webhook -f`
3. Test webhook endpoint: `curl -X POST http://localhost:9000/webhook`
4. Verify GitHub webhook configuration

### Health Checks Failing
1. Check individual endpoints:
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/api/health
   curl https://ss.gonxt.tech/health
   ```
2. Check service status: `pm2 status`
3. Check Nginx: `sudo systemctl status nginx`

## 📊 Performance Monitoring

### Key Metrics
- **Response time**: Health check endpoints
- **Uptime**: Service availability
- **Resource usage**: CPU, memory, disk
- **Error rates**: Application and system errors

### Monitoring Commands
```bash
# System resources
htop
df -h
free -h

# Application performance
pm2 monit
curl -w "@curl-format.txt" -s https://ss.gonxt.tech/health

# Database performance
psql -h localhost -U salessync -d salessync -c "SELECT * FROM pg_stat_activity;"
```

## 🔄 Backup & Recovery

### Automatic Backups
- **Frequency**: Before each deployment
- **Location**: `/backups/salessync/`
- **Retention**: 7 days (automatic cleanup)
- **Contents**: Application code (excluding node_modules, .git)

### Manual Backup
```bash
sudo tar -czf /backups/salessync/manual-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  --exclude=node_modules --exclude=.git --exclude=dist --exclude=build \
  /home/ubuntu/SalesSyncAI
```

### Recovery Process
1. Stop services: `pm2 stop all`
2. Restore backup: `sudo tar -xzf /backups/salessync/backup-YYYYMMDD-HHMMSS.tar.gz`
3. Restart services: `pm2 start ecosystem.config.js`

## 🎯 Success Indicators

After setup, you should see:
- ✅ Application starts automatically on reboot
- ✅ GitHub Actions deploy successfully on main branch changes
- ✅ Webhook deployments work (if configured)
- ✅ Health checks pass consistently
- ✅ Monitoring detects and recovers from issues
- ✅ All services show "active (running)" status

## 📞 Support

For issues with the CI/CD pipeline:
1. Check this documentation
2. Review log files
3. Test individual components
4. Verify configuration files
5. Check GitHub Actions workflow runs

---

**🚀 Your SalesSync AI application now has enterprise-grade CI/CD and auto-deployment capabilities!**