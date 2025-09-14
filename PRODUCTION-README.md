# SalesSync AI - Production Deployment

🚀 **Production-ready deployment for AWS t4g.medium Ubuntu server with SSL for domain `assai.gonxt.tech`**

## Quick Start

```bash
# Clone repository to production directory
git clone https://github.com/Reshigan/SalesSyncAI.git /opt/salessync
cd /opt/salessync

# Run automated production deployment
sudo ./scripts/deploy.sh
```

## What's Included

### 🐳 Docker Configuration
- **Multi-stage production Dockerfiles** with security hardening
- **Production docker-compose.yml** with all services
- **Health checks** and restart policies
- **Non-root user** containers for security

### 🔒 SSL & Security
- **Automated SSL certificates** with Let's Encrypt
- **Nginx reverse proxy** with security headers
- **Rate limiting** and DDoS protection
- **Firewall configuration** with UFW

### 📊 Monitoring & Logging
- **Health monitoring** script with automated checks
- **Log rotation** and management
- **Performance monitoring** with resource tracking
- **Automated alerting** (configurable)

### 💾 Backup System
- **Automated daily backups** of database and files
- **S3 integration** for offsite backups
- **Backup verification** and integrity checks
- **Configurable retention** policies

### 🔧 Maintenance Scripts
- **Automated deployment** script
- **Zero-downtime updates** script
- **SSL certificate renewal** automation
- **System monitoring** and health checks

## Services Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │    │   Let's Encrypt │
│   (Port 80/443) │    │    (Certbot)    │
└─────────┬───────┘    └─────────────────┘
          │
          ├─── Frontend (React + Nginx)
          │
          └─── Backend API (Node.js + Express)
                    │
                    ├─── PostgreSQL Database
                    │
                    └─── Redis Cache
```

## Production Features

### ✅ Security
- SSL/TLS encryption with strong ciphers
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting and request throttling
- Firewall configuration
- Non-root container execution
- Input validation and sanitization

### ✅ Performance
- Nginx reverse proxy with caching
- Gzip compression
- Static asset optimization
- Database connection pooling
- Redis caching layer
- Optimized Docker images

### ✅ Reliability
- Health checks for all services
- Automatic service restart
- Database backup automation
- Log rotation and management
- Monitoring and alerting
- Zero-downtime deployments

### ✅ Scalability
- Container-based architecture
- Horizontal scaling ready
- Load balancer compatible
- Database replication ready
- CDN integration ready

## Environment Configuration

The production environment includes:

- **Database**: PostgreSQL 15 with optimized settings
- **Cache**: Redis 7 for session and data caching
- **Web Server**: Nginx with production optimizations
- **SSL**: Let's Encrypt certificates with auto-renewal
- **Monitoring**: Health checks and performance monitoring
- **Backups**: Automated daily backups with retention

## Deployment Scripts

### `scripts/deploy.sh`
Complete production deployment automation:
- System setup and security configuration
- Docker installation and configuration
- SSL certificate generation
- Application deployment
- Monitoring and backup setup

### `scripts/update.sh`
Zero-downtime application updates:
- Git pull latest changes
- Docker image rebuilding
- Rolling service updates
- Database migrations
- Health verification

### `scripts/monitor.sh`
Comprehensive monitoring:
- Service health checks
- Resource monitoring
- SSL certificate monitoring
- Log analysis
- Automated service restart

### `scripts/backup.sh`
Automated backup system:
- Database backups with compression
- File system backups
- Configuration backups
- S3 upload integration
- Backup verification

### `scripts/ssl-renew.sh`
SSL certificate management:
- Certificate expiry checking
- Automated renewal
- Nginx reload
- Notification system

## File Structure

```
/opt/salessync/
├── backend/                 # Backend application
├── frontend/               # Frontend application
├── nginx/                  # Nginx configuration
│   ├── nginx.conf         # Main Nginx config
│   └── conf.d/            # Site configurations
├── scripts/               # Deployment scripts
│   ├── deploy.sh         # Main deployment
│   ├── update.sh         # Application updates
│   ├── monitor.sh        # Health monitoring
│   ├── backup.sh         # Backup automation
│   └── ssl-renew.sh      # SSL management
├── database/              # Database initialization
├── docker-compose.yml     # Production services
├── .env.production       # Environment template
└── DEPLOYMENT.md         # Detailed documentation
```

## Quick Commands

```bash
# Check application status
docker-compose ps

# View logs
docker-compose logs -f

# Monitor health
./scripts/monitor.sh check

# Create backup
./scripts/backup.sh full

# Update application
./scripts/update.sh

# Renew SSL certificates
./scripts/ssl-renew.sh
```

## Access Points

- **Application**: https://assai.gonxt.tech
- **API**: https://assai.gonxt.tech/api
- **Health Check**: https://assai.gonxt.tech/health

## Support

For production deployment support:
- **Email**: admin@gonxt.tech
- **Documentation**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Repository**: https://github.com/Reshigan/SalesSyncAI

---

**Ready for production deployment on AWS t4g.medium Ubuntu server with SSL for domain `assai.gonxt.tech`** 🚀