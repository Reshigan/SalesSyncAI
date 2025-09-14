# SalesSyncAI Production Deployment Guide

This guide provides comprehensive instructions for deploying SalesSyncAI in production on AWS t4g.medium Ubuntu server with SSL for domain `assai.gonxt.tech`, as well as development deployment options.

## 🚀 Quick Start

### Production Deployment (AWS t4g.medium Ubuntu Server)

```bash
# Clone the repository
git clone https://github.com/Reshigan/SalesSyncAI.git /opt/salessync
cd /opt/salessync

# Run the production deployment script
sudo ./scripts/deploy.sh
```

### Development Deployment Options

#### Option 1: Simple Docker Deployment (Current Directory)

```bash
# Clone the repository
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI

# Run the development deployment script
./docker-deploy.sh
```

#### Option 2: Home Directory Deployment with Cleanup

```bash
# Clone the repository
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI

# Run the home deployment script (cleans up old installations)
./home-deploy.sh
```

## 📋 Prerequisites

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher (or docker-compose v1.29+)
- **System Requirements**: 
  - 4GB RAM minimum (8GB recommended)
  - 10GB free disk space
  - Linux/macOS/Windows with WSL2

### Installing Docker

#### Ubuntu/Debian
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

#### CentOS/RHEL
```bash
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

#### macOS
```bash
# Install Docker Desktop from https://docker.com/products/docker-desktop
# Or using Homebrew:
brew install --cask docker
```

## 🏗️ Architecture

The deployment consists of four main services:

1. **Frontend** (Nginx + React) - Port 80
2. **Backend** (Node.js + Express) - Port 3000
3. **Database** (PostgreSQL 15) - Port 5432
4. **Cache** (Redis 7) - Port 6379

## 📁 Deployment Options

### 1. Current Directory Deployment

Uses `docker-deploy.sh` to deploy in the current directory:

```bash
./docker-deploy.sh
```

**Features:**
- Quick deployment
- Automatic password generation
- Health checks
- Database migrations
- Environment file creation

### 2. Home Directory Deployment

Uses `home-deploy.sh` for a clean home directory installation:

```bash
./home-deploy.sh
```

**Features:**
- Cleans up old installations in `/root`, `/opt`, `/var/www`
- Removes old Docker containers and images
- Stops and removes systemd services
- Deploys to `$HOME/salessync-production`
- Creates management scripts
- Interactive cleanup confirmation

## 🔧 Management Commands

After deployment, you can manage the application using these commands:

### Using Docker Compose Directly

```bash
# Check status
docker compose -f docker-compose.simple.yml ps

# View logs
docker compose -f docker-compose.simple.yml logs -f [service]

# Restart services
docker compose -f docker-compose.simple.yml restart [service]

# Stop all services
docker compose -f docker-compose.simple.yml down

# Stop and remove volumes
docker compose -f docker-compose.simple.yml down -v
```

### Using Management Scripts (Home Deployment)

```bash
cd $HOME/salessync-production

# Check status
./status.sh

# View logs
./logs.sh [service|all]

# Start services
./start.sh

# Stop services
./stop.sh

# Update deployment
./update.sh
```

## 🔐 Security Configuration

### Environment Variables

The deployment automatically generates secure passwords and configurations:

- `POSTGRES_PASSWORD`: Database password
- `REDIS_PASSWORD`: Redis password
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: JWT refresh token secret

### Network Security

- All services run in an isolated Docker network
- Database and Redis are not exposed to the host by default
- Frontend uses Nginx with security headers
- Backend includes rate limiting and CORS protection

### Production Hardening

For production deployments, consider:

1. **Reverse Proxy**: Use Nginx or Traefik as a reverse proxy
2. **SSL/TLS**: Configure HTTPS with Let's Encrypt
3. **Firewall**: Restrict access to necessary ports only
4. **Monitoring**: Add monitoring and logging solutions
5. **Backups**: Implement database backup strategies

## 🔍 Troubleshooting

### Common Issues

#### 1. Permission Errors
```bash
# Fix Docker permissions
sudo usermod -aG docker $USER
# Log out and back in, or run:
newgrp docker
```

#### 2. Port Conflicts
```bash
# Check what's using ports 80, 3000, 5432, 6379
sudo netstat -tlnp | grep -E ':(80|3000|5432|6379)\s'

# Stop conflicting services
sudo systemctl stop apache2  # or nginx
sudo systemctl stop postgresql
sudo systemctl stop redis
```

#### 3. Container Health Issues
```bash
# Check container logs
docker compose -f docker-compose.simple.yml logs [service]

# Restart unhealthy containers
docker compose -f docker-compose.simple.yml restart [service]
```

#### 4. Database Connection Issues
```bash
# Check database logs
docker compose -f docker-compose.simple.yml logs postgres

# Reset database
docker compose -f docker-compose.simple.yml down -v
docker compose -f docker-compose.simple.yml up -d
```

### Health Check Endpoints

- **Frontend**: `http://localhost/health.html`
- **Backend**: `http://localhost:3000/health`
- **API Status**: `http://localhost:3000/api/status`

### Log Locations

- **Application Logs**: Docker container logs
- **Database Logs**: PostgreSQL container logs
- **Web Server Logs**: Nginx container logs

## 🔄 Updates and Maintenance

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.simple.yml down
docker compose -f docker-compose.simple.yml up -d --build
```

### Database Migrations

```bash
# Run migrations manually
docker compose -f docker-compose.simple.yml exec backend npx prisma migrate deploy
```

### Backup and Restore

#### Database Backup
```bash
# Create backup
docker compose -f docker-compose.simple.yml exec postgres pg_dump -U salessync_user salessync_prod > backup.sql

# Restore backup
docker compose -f docker-compose.simple.yml exec -T postgres psql -U salessync_user salessync_prod < backup.sql
```

#### Volume Backup
```bash
# Backup all volumes
docker run --rm -v salessyncai_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```

## 📊 Monitoring

### Container Status
```bash
# Check all containers
docker ps

# Check resource usage
docker stats
```

### Application Metrics
```bash
# API health check
curl http://localhost:3000/health

# Frontend health check
curl http://localhost/health.html
```

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review container logs: `docker compose logs [service]`
3. Verify system requirements are met
4. Check Docker and Docker Compose versions
5. Ensure all required ports are available

## 📝 Configuration Files

- `docker-compose.simple.yml`: Main Docker Compose configuration
- `backend/Dockerfile.simple`: Backend container configuration
- `frontend/Dockerfile.prod`: Frontend container configuration
- `.env`: Environment variables (auto-generated)
- `frontend/nginx.prod.conf`: Nginx configuration

## 🎯 Next Steps

After successful deployment:

1. Access the application at `http://your-domain`
2. Configure your domain/DNS settings
3. Set up SSL/TLS certificates for production
4. Configure monitoring and alerting
5. Set up automated backups
6. Review and customize security settings

---

## 🏭 Production Deployment (AWS t4g.medium Ubuntu Server)

### Production Prerequisites

- **Server**: AWS t4g.medium instance (2 vCPU, 4 GB RAM)
- **OS**: Ubuntu 20.04 LTS or later
- **Storage**: At least 20 GB available disk space
- **Domain**: `assai.gonxt.tech` pointing to server IP
- **SSL**: Let's Encrypt certificates (automated)

### Production Architecture

The production deployment includes:

1. **Frontend** (React + Nginx) - Port 80/443
2. **Backend** (Node.js + Express) - Port 3001
3. **Database** (PostgreSQL 15) - Port 5432
4. **Cache** (Redis 7) - Port 6379
5. **Reverse Proxy** (Nginx) - Port 80/443
6. **SSL Certificates** (Let's Encrypt/Certbot)

### Production Deployment Steps

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y curl git ufw fail2ban

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### 2. Automated Production Deployment

```bash
# Clone repository to production directory
git clone https://github.com/Reshigan/SalesSyncAI.git /opt/salessync
cd /opt/salessync

# Run production deployment script
sudo ./scripts/deploy.sh
```

The deployment script will:
- Install Docker and Docker Compose
- Set up firewall rules
- Create necessary directories
- Configure SSL certificates with Let's Encrypt
- Deploy all services with production configuration
- Set up monitoring and backup automation

#### 3. Manual Production Configuration

If you prefer manual setup:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Configure environment
cp .env.production .env
nano .env  # Edit with your production values

# Deploy services
docker-compose build
docker-compose up -d

# Run database migrations
docker-compose exec backend npx prisma migrate deploy
```

### Production Environment Configuration

Edit `.env` with production values:

```bash
# Database Configuration
POSTGRES_DB=salessync
POSTGRES_USER=salessync
POSTGRES_PASSWORD=your-secure-production-password

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-at-least-32-characters

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
S3_BUCKET_NAME=salessync-uploads-production

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Application URLs
FRONTEND_URL=https://assai.gonxt.tech
BACKEND_URL=https://assai.gonxt.tech/api
CORS_ORIGIN=https://assai.gonxt.tech

# SSL Configuration
SSL_EMAIL=admin@gonxt.tech
DOMAIN=assai.gonxt.tech
```

### Production SSL Setup

SSL certificates are automatically managed:

```bash
# Check SSL certificate status
./scripts/ssl-renew.sh

# Manual certificate renewal
docker-compose run --rm certbot renew

# View certificate details
openssl x509 -in /etc/letsencrypt/live/assai.gonxt.tech/fullchain.pem -text -noout
```

### Production Monitoring

#### Health Monitoring

```bash
# Basic health check
./scripts/monitor.sh check

# Full monitoring report
./scripts/monitor.sh full

# Restart failed services
./scripts/monitor.sh restart
```

#### Application Access

- **Production URL**: https://assai.gonxt.tech
- **API Endpoint**: https://assai.gonxt.tech/api
- **Health Check**: https://assai.gonxt.tech/health

### Production Backup System

#### Automated Backups

Backups run automatically daily at 2 AM:

```bash
# Manual backup
./scripts/backup.sh full

# Database only
./scripts/backup.sh database

# Files only
./scripts/backup.sh files
```

#### Backup Locations

- **Local**: `/opt/salessync-backups/`
- **S3**: `s3://salessync-backups-production/` (if configured)

### Production Updates

```bash
# Update application
./scripts/update.sh

# Manual update process
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

### Production Troubleshooting

#### Service Issues

```bash
# Check all services
docker-compose ps

# View service logs
docker-compose logs -f [service]

# Restart specific service
docker-compose restart [service]
```

#### SSL Issues

```bash
# Check certificate expiry
openssl x509 -enddate -noout -in /etc/letsencrypt/live/assai.gonxt.tech/fullchain.pem

# Test SSL connection
openssl s_client -servername assai.gonxt.tech -connect assai.gonxt.tech:443
```

#### Performance Issues

```bash
# Check system resources
htop
df -h
free -h

# Check Docker resource usage
docker stats

# Check application performance
curl -w "@curl-format.txt" -o /dev/null -s https://assai.gonxt.tech
```

### Production Security

- **Firewall**: UFW configured with minimal open ports
- **SSL**: Strong TLS configuration with HSTS
- **Headers**: Security headers configured in Nginx
- **Rate Limiting**: API rate limiting enabled
- **Fail2ban**: Intrusion prevention system active
- **Updates**: Automated security updates enabled

### Production Maintenance

#### Automated Tasks (Cron Jobs)

```bash
# Health check every 5 minutes
*/5 * * * * /opt/salessync/scripts/monitor.sh check

# Daily backup at 2 AM
0 2 * * * /opt/salessync/scripts/backup.sh full

# SSL renewal check daily at 3 AM
0 3 * * * /opt/salessync/scripts/ssl-renew.sh

# Weekly full monitoring report
0 6 * * 1 /opt/salessync/scripts/monitor.sh full
```

#### Manual Maintenance

```bash
# Clean up old Docker images
docker system prune -f

# Update system packages
sudo apt update && sudo apt upgrade -y

# Check log sizes
du -sh /var/log/salessync/
```

### Production Support

For production issues:

1. Check monitoring logs: `/var/log/salessync/`
2. Review application logs: `docker-compose logs`
3. Verify SSL certificates: `./scripts/ssl-renew.sh`
4. Check system resources: `./scripts/monitor.sh full`
5. Contact support: admin@gonxt.tech

---

For more information, visit the [SalesSyncAI GitHub repository](https://github.com/Reshigan/SalesSyncAI).