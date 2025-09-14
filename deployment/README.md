# SalesSync Deployment

## Production Deployment

For production deployment on a clean Ubuntu 22.04 server:

```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/clean-server-deploy.sh -o clean-deploy.sh
sudo chmod +x clean-deploy.sh
sudo ./clean-deploy.sh
```

## Deployment Options

### `clean-server-deploy.sh` (Recommended)
- **Clean server installation** - removes all conflicting packages
- **Fresh installations** of all components
- **Production-optimized** configurations
- **Enhanced security** hardening
- **Comprehensive monitoring** and backup

### Script Commands

```bash
# Full deployment (default)
sudo ./clean-server-deploy.sh

# Clean existing installations only
sudo ./clean-server-deploy.sh clean

# Verify installation
sudo ./clean-server-deploy.sh verify

# Check system status
sudo ./clean-server-deploy.sh status
```

## What Gets Installed

### Clean Installation Process
1. **Removes conflicting packages**: Apache, MySQL, old Node.js, Redis, PostgreSQL
2. **Fresh installations**: Node.js 18, PostgreSQL 15, Redis 7, Nginx
3. **Security hardening**: UFW firewall, Fail2Ban, SSL certificates
4. **Monitoring setup**: Health checks, log rotation, automated backups
5. **Application deployment**: PM2 cluster mode, optimized configurations

### System Requirements
- **OS**: Ubuntu 22.04 LTS
- **Memory**: 2GB minimum, 4GB+ recommended
- **Disk**: 15GB minimum available space
- **Network**: Internet connection for package downloads

### Installation Time
- **Total Time**: 15-20 minutes
- **Clean Process**: 3-5 minutes
- **Installation**: 10-12 minutes
- **Verification**: 2-3 minutes

## Post-Installation

### Application Access
- **Frontend**: https://SSAI.gonxt.tech
- **Backend API**: https://SSAI.gonxt.tech/api
- **Health Check**: https://SSAI.gonxt.tech/health

### Login Credentials
- **Super Admin**: superadmin@salessync.com / SuperAdmin123!
- **Company Admin**: admin@testcompany.com / Admin123!
- **Manager**: manager@testcompany.com / Manager123!
- **Field Agent**: agent@testcompany.com / Agent123!

### Management Commands
```bash
# Application management
pm2 status
pm2 logs salessync-backend
pm2 restart salessync-backend

# System services
sudo systemctl status postgresql redis nginx
sudo systemctl restart postgresql redis nginx

# Monitoring and backup
sudo tail -f /var/log/salessync-monitor.log
sudo /usr/local/bin/salessync-backup.sh
```

## Support

For issues or questions:
- **Email**: support@gonxt.tech
- **Repository**: https://github.com/Reshigan/SalesSyncAI
- **Documentation**: Check installation reports in `/opt/salessync/`