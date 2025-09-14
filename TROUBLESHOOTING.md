# SalesSync AI - Troubleshooting Guide

## Common Deployment Issues

### 1. Docker Installation Failed

**Problem:** `curl: (23) Failure writing output to destination`

**Solution:**
```bash
# Check if Docker is already installed
docker --version

# If Docker exists but not working, restart it
sudo systemctl restart docker
sudo systemctl enable docker

# If Docker doesn't exist, use the fixed deployment script
./deploy-fixed.sh
```

### 2. Permission Denied Errors

**Problem:** Cannot access Docker socket

**Solution:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and log back in, or run:
newgrp docker

# Test Docker access
docker ps
```

### 3. Services Not Starting

**Problem:** Containers exit immediately or fail to start

**Solution:**
```bash
# Check service status
docker-compose ps

# View logs for specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# Restart all services
docker-compose restart

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### 4. Database Connection Issues

**Problem:** Backend cannot connect to database

**Solution:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Reset database (WARNING: This will delete all data)
docker-compose down -v
docker-compose up -d postgres
sleep 10
docker-compose up -d backend
```

### 5. SSL Certificate Issues

**Problem:** Cannot obtain SSL certificate

**Solution:**
```bash
# Check if domain points to your server
nslookup ssai.gonxt.tech

# Stop nginx temporarily
docker-compose stop nginx

# Try to get certificate manually
sudo certbot certonly --standalone -d ssai.gonxt.tech --email admin@gonxt.tech --agree-tos --non-interactive

# Restart nginx
docker-compose start nginx
```

### 6. Frontend Build Issues

**Problem:** Frontend container fails to build

**Solution:**
```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend only
docker-compose build --no-cache frontend
docker-compose up -d frontend

# If still failing, check Node.js memory
docker-compose down
docker-compose up -d --build frontend
```

### 7. Port Already in Use

**Problem:** `Port 80/443 already in use`

**Solution:**
```bash
# Check what's using the ports
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Stop conflicting services
sudo systemctl stop apache2  # if Apache is running
sudo systemctl stop nginx    # if system Nginx is running

# Or kill specific processes
sudo fuser -k 80/tcp
sudo fuser -k 443/tcp
```

### 8. Out of Disk Space

**Problem:** No space left on device

**Solution:**
```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a
docker volume prune

# Remove unused packages
sudo apt autoremove
sudo apt autoclean
```

## Quick Fixes

### Reset Everything
```bash
# Complete reset (WARNING: Deletes all data)
docker-compose down -v
docker system prune -a
./deploy-fixed.sh
```

### Check Application Health
```bash
# Test all endpoints
curl -k https://ssai.gonxt.tech/health
curl -k https://ssai.gonxt.tech/api/health
curl -k https://ssai.gonxt.tech

# Check service status
docker-compose ps
docker-compose logs --tail=50
```

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Check status
docker-compose ps
```

## Log Locations

- **Application logs:** `docker-compose logs [service]`
- **System logs:** `/var/log/salessync/`
- **Nginx logs:** `docker-compose logs nginx`
- **Database logs:** `docker-compose logs postgres`

## Getting Help

1. **Check service status:** `docker-compose ps`
2. **View recent logs:** `docker-compose logs --tail=100`
3. **Test connectivity:** `curl -k https://ssai.gonxt.tech/health`
4. **Check disk space:** `df -h`
5. **Check memory:** `free -h`

## Emergency Commands

```bash
# Stop all services
docker-compose down

# Emergency restart
sudo reboot

# Complete cleanup and redeploy
docker-compose down -v
docker system prune -a -f
./deploy-fixed.sh
```