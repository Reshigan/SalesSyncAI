# SalesSyncAI Home Directory Deployment

This deployment script solves permission issues by installing SalesSyncAI in the user's home directory instead of system directories like `/opt` or `/root`.

## Features

- **No Permission Issues**: Installs in home directory (`~/salessync-prod`)
- **Complete Cleanup**: Removes old installations from `/opt` and `/root`
- **Production Ready**: Full production configuration with security
- **User-Friendly**: Works for both root and non-root users
- **Comprehensive**: Handles all services (PostgreSQL, Redis, Nginx, PM2)

## Quick Start

### Option 1: Direct Execution
```bash
# Make executable and run
chmod +x deployment/cleanup-and-home-deploy.sh
./deployment/cleanup-and-home-deploy.sh
```

### Option 2: With Custom Domain
```bash
# Set domain and run
export DOMAIN="your-domain.com"
./deployment/cleanup-and-home-deploy.sh
```

### Option 3: One-liner
```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/cleanup-and-home-deploy.sh | bash
```

## What the Script Does

### Cleanup Phase
1. **Stops all running services** (PM2, Docker, etc.)
2. **Removes old installations** from:
   - `/opt/salessync*`
   - `/opt/SalesSyncAI*`
   - `/root/salessync*`
   - `/root/SalesSyncAI*`
   - Previous home directory installations
3. **Cleans up configurations**:
   - PM2 processes
   - Nginx configurations
   - Old database connections

### Deployment Phase
1. **System Setup**:
   - Updates packages
   - Installs Node.js 20 LTS
   - Installs PostgreSQL, Redis, Nginx
   - Installs PM2 process manager

2. **Application Setup**:
   - Clones repository to `~/salessync-prod`
   - Configures database with secure credentials
   - Sets up Redis with authentication
   - Builds frontend and backend

3. **Service Configuration**:
   - Configures Nginx reverse proxy
   - Sets up PM2 process management
   - Configures firewall (if available)
   - Starts all services

## Installation Location

```
~/salessync-prod/
├── backend/           # Node.js backend
├── frontend/          # React frontend (built)
├── logs/             # Application logs
├── ecosystem.config.js # PM2 configuration
└── deployment-info.txt # Deployment details
```

## Service Management

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs salessync-backend

# Restart application
pm2 restart salessync-backend

# Stop application
pm2 stop salessync-backend

# Start application
pm2 start salessync-backend
```

### System Services
```bash
# Check service status
sudo systemctl status nginx postgresql redis-server

# Restart services
sudo systemctl restart nginx
sudo systemctl restart postgresql
sudo systemctl restart redis-server
```

## Configuration Files

### Backend Environment (~/salessync-prod/backend/.env)
- Database connection
- Redis configuration
- JWT secrets
- CORS settings
- Upload limits

### Frontend Environment (~/salessync-prod/frontend/.env.production)
- API URL configuration
- Application settings
- Build optimizations

### Nginx Configuration (/etc/nginx/sites-available/salessync)
- Reverse proxy setup
- Security headers
- Static file serving
- Gzip compression

## Security Features

1. **Database Security**:
   - Unique database user and password
   - Encrypted password storage
   - Connection restrictions

2. **Redis Security**:
   - Password authentication
   - Local-only binding

3. **Web Security**:
   - Security headers (XSS, CSRF protection)
   - Gzip compression
   - File upload limits

4. **System Security**:
   - Firewall configuration (UFW)
   - Service isolation
   - Log rotation

## Troubleshooting

### Check Installation
```bash
# Verify installation directory
ls -la ~/salessync-prod/

# Check deployment info
cat ~/salessync-prod/deployment-info.txt
```

### Check Services
```bash
# Check if application is running
curl http://localhost/health

# Check PM2 status
pm2 status

# Check system services
sudo systemctl status nginx postgresql redis-server
```

### View Logs
```bash
# Application logs
pm2 logs salessync-backend

# Nginx logs
sudo tail -f /var/log/nginx/salessync_access.log
sudo tail -f /var/log/nginx/salessync_error.log

# System logs
sudo journalctl -u nginx -f
sudo journalctl -u postgresql -f
```

### Common Issues

1. **Port 80 in use**:
   ```bash
   sudo netstat -tlnp | grep :80
   sudo systemctl stop apache2  # if Apache is running
   ```

2. **Database connection issues**:
   ```bash
   # Test database connection
   psql -h localhost -U salessync_prod -d salessync_prod
   ```

3. **Permission issues**:
   ```bash
   # Fix file permissions
   chmod -R 755 ~/salessync-prod/
   chmod 600 ~/salessync-prod/backend/.env
   ```

## Advantages of Home Directory Installation

1. **No Permission Issues**: User owns all files
2. **Easy Management**: No sudo required for app management
3. **User Isolation**: Each user can have their own installation
4. **Easy Backup**: Simple to backup user's home directory
5. **Easy Removal**: Just delete the directory
6. **Development Friendly**: Easy to modify and test

## URLs After Installation

- **Application**: http://localhost or http://your-domain.com
- **API**: http://localhost/api or http://your-domain.com/api
- **Health Check**: http://localhost/health

## Next Steps

1. **SSL Certificate** (for production):
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

2. **Domain Configuration**:
   - Point your domain to the server IP
   - Update DNS records

3. **Monitoring Setup**:
   - Configure log monitoring
   - Set up health checks
   - Configure backup schedules

## Support

For issues or questions:
1. Check the deployment-info.txt file
2. Review the logs using the commands above
3. Ensure all services are running
4. Verify network connectivity and firewall settings