# SalesSyncAI Production Deployment Commands

## Quick Deployment Commands

### 1. Full Production Deployment
```bash
# SSH into your AWS server (13.247.192.46)
ssh ubuntu@13.247.192.46

# Run automated production deployment
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/production-deploy.sh | sudo bash
```

### 2. Verify Deployment
```bash
# Run deployment verification
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/verify-deployment.sh | sudo bash
```

### 3. Manual Deployment (if needed)
```bash
# Clone repository
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI

# Make scripts executable
chmod +x deployment/production-deploy.sh deployment/verify-deployment.sh

# Run deployment
sudo ./deployment/production-deploy.sh

# Verify deployment
sudo ./deployment/verify-deployment.sh
```

## Post-Deployment Commands

### Check Application Status
```bash
# Check all services
sudo systemctl status nginx postgresql redis-server

# Check PM2 processes
sudo pm2 status

# Check application health
curl http://13.247.192.46/health
```

### View Logs
```bash
# Backend application logs
sudo pm2 logs salessync-backend

# Nginx logs
sudo tail -f /var/log/nginx/salessync_access.log
sudo tail -f /var/log/nginx/salessync_error.log

# System logs
sudo journalctl -u nginx -f
sudo journalctl -u postgresql -f
```

### Restart Services
```bash
# Restart backend application
sudo pm2 restart salessync-backend

# Restart Nginx
sudo systemctl restart nginx

# Restart database
sudo systemctl restart postgresql

# Restart Redis
sudo systemctl restart redis-server
```

### Database Management
```bash
# Connect to database
sudo -u postgres psql salessync_prod

# Create backup
sudo -u postgres pg_dump salessync_prod > /opt/salessync/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# View database stats
sudo -u postgres psql salessync_prod -c "SELECT schemaname,tablename,n_tup_ins,n_tup_upd,n_tup_del FROM pg_stat_user_tables;"
```

### SSL Certificate Setup (Optional)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Monitoring Commands
```bash
# System metrics
curl http://13.247.192.46/metrics

# Detailed health check
curl http://13.247.192.46/api/system/health

# Monitor system resources
htop
df -h
free -h
```

## Access URLs

- **Application:** http://13.247.192.46
- **API Docs:** http://13.247.192.46/api/docs
- **Health Check:** http://13.247.192.46/health
- **Metrics:** http://13.247.192.46/metrics

## Demo Login Credentials

- **Super Admin:** superadmin@salessync.com / SuperAdmin123!
- **Demo Admin:** admin@premiumbeverages.com / DemoAdmin123!
- **Sales Manager:** manager@premiumbeverages.com / Manager123!
- **Field Agent:** james.wilson@premiumbeverages.com / Agent123!
- **Test Admin:** admin@testcompany.com / TestAdmin123!

## Troubleshooting

### If deployment fails:
```bash
# Check system logs
sudo journalctl -xe

# Check specific service
sudo systemctl status [service-name]

# Restart deployment
sudo ./deployment/production-deploy.sh
```

### If application is not accessible:
```bash
# Check Nginx configuration
sudo nginx -t

# Check firewall
sudo ufw status

# Check if ports are listening
sudo netstat -tlnp | grep -E ':(80|443|3000)'
```

### If database issues:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connections
sudo -u postgres psql -c "\l"

# Reset database (if needed)
sudo -u postgres dropdb salessync_prod
sudo -u postgres createdb salessync_prod
cd /opt/salessync/backend && npm run seed
```

## Performance Optimization

### Monitor Performance
```bash
# Check PM2 monitoring
sudo pm2 monit

# Check system resources
iostat 1 5
vmstat 1 5
```

### Optimize Database
```bash
# Analyze database
sudo -u postgres psql salessync_prod -c "ANALYZE;"

# Check slow queries
sudo -u postgres psql salessync_prod -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

## Backup and Recovery

### Create Full Backup
```bash
# Create backup directory
sudo mkdir -p /opt/salessync/backups

# Database backup
sudo -u postgres pg_dump salessync_prod > /opt/salessync/backups/db_backup_$(date +%Y%m%d_%H%M%S).sql

# Application files backup
sudo tar -czf /opt/salessync/backups/app_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /opt salessync
```

### Restore from Backup
```bash
# Restore database
sudo -u postgres psql salessync_prod < /opt/salessync/backups/db_backup_YYYYMMDD_HHMMSS.sql

# Restore application files
sudo tar -xzf /opt/salessync/backups/app_backup_YYYYMMDD_HHMMSS.tar.gz -C /opt
```

---

**Need Help?** Check the full deployment guide: `PRODUCTION_DEPLOYMENT_GUIDE.md`