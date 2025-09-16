# 🧹 SalesSync Server Cleanup Scripts

This document explains the different cleanup and installation scripts available for SalesSync deployment.

## 🚨 When to Use Cleanup Scripts

Use these scripts when you encounter:
- **Docker conflicts** (like the nexus-db container issues you mentioned)
- **Multiple failed deployment attempts** leaving conflicting configurations
- **Package dependency conflicts** between different Node.js versions
- **Database permission issues** that persist after multiple fixes
- **Nginx configuration conflicts** from previous installations
- **Port conflicts** from other applications
- **Corrupted installations** that won't start properly

## 📋 Available Cleanup Options

### 1. 🔥 Nuclear Reset (`clean-server-install.sh`)
**Use when**: Server is completely broken or has multiple conflicting installations

**What it does**:
- ✅ Stops ALL services (PM2, Nginx, PostgreSQL, Docker)
- ✅ Removes ALL packages (Node.js, npm, PostgreSQL, Nginx, Docker)
- ✅ Deletes ALL data and configurations
- ✅ Performs complete system update
- ✅ Fresh installation of everything
- ✅ Automatic SSL certificate setup

**Command**:
```bash
sudo wget -O clean-install.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/clean-server-install.sh && sudo chmod +x clean-install.sh && sudo ./clean-install.sh
```

**⚠️ WARNING**: This will delete EVERYTHING and start completely fresh!

### 2. 🧽 Advanced Clean (`clean-server-advanced.sh`)
**Use when**: You want to choose the level of cleanup

**Interactive Options**:
1. **🔥 NUCLEAR RESET** - Same as above, complete wipe
2. **🧽 DEEP CLEAN** - Remove SalesSync and conflicting services, keep system packages
3. **🔄 SOFT RESET** - Remove SalesSync only, keep databases and configurations
4. **🐳 DOCKER CLEANUP** - Remove Docker completely and install SalesSync natively
5. **🚪 EXIT** - Cancel operation

**Command**:
```bash
sudo wget -O clean-advanced.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/clean-server-advanced.sh && sudo chmod +x clean-advanced.sh && sudo ./clean-advanced.sh
```

## 🐳 Docker Conflict Resolution

Based on your Docker issue with `nexus-db` container, here's what the Docker cleanup does:

```bash
# What the Docker cleanup removes:
- Stops all running containers
- Removes all containers (including nexus-db)
- Removes all Docker images
- Removes all Docker volumes and networks
- Uninstalls Docker completely
- Cleans up Docker directories and processes
```

After Docker cleanup, SalesSync will be installed with:
- **Native PostgreSQL** (not containerized)
- **Native Nginx** (not containerized)
- **Native Node.js/PM2** (not containerized)

This eliminates all Docker-related conflicts.

## 🔧 Comparison with Regular Fix Scripts

| Script Type | Use Case | Data Loss | Time Required |
|-------------|----------|-----------|---------------|
| `fix-production-deployment.sh` | Minor issues, working server | None | 5-10 minutes |
| `clean-server-advanced.sh` (Soft) | App issues only | App data only | 10-15 minutes |
| `clean-server-advanced.sh` (Deep) | Multiple conflicts | SalesSync data | 15-25 minutes |
| `clean-server-install.sh` (Nuclear) | Completely broken server | Everything | 20-30 minutes |

## 🎯 Recommended Approach for Your Docker Issue

Based on your Docker container conflicts, I recommend:

### Option 1: Docker Cleanup (Recommended)
```bash
sudo wget -O clean-advanced.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/clean-server-advanced.sh && sudo chmod +x clean-advanced.sh && sudo ./clean-advanced.sh
```
Then select option **4) 🐳 DOCKER CLEANUP**

### Option 2: Nuclear Reset (If you want a completely fresh start)
```bash
sudo wget -O clean-install.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/clean-server-install.sh && sudo chmod +x clean-install.sh && sudo ./clean-install.sh
```

## 🔍 What Happens During Cleanup

### Pre-Cleanup Safety Checks
- ✅ Confirms you want to proceed (requires typing confirmation)
- ✅ Checks if running as root
- ✅ Shows exactly what will be removed

### Cleanup Process
1. **Stop Services**: Gracefully stops all running services
2. **Remove Conflicts**: Removes conflicting packages and configurations
3. **Clean System**: Updates system packages and cleans cache
4. **Fresh Install**: Installs latest versions of all dependencies
5. **Configure**: Sets up proper configurations
6. **Verify**: Tests that everything is working

### Post-Cleanup Verification
- ✅ Service status checks
- ✅ Application health checks
- ✅ SSL certificate validation
- ✅ Database connectivity tests

## 🚀 After Cleanup

Your server will have:
- **Fresh SalesSync installation** at `/opt/salessync`
- **Clean database** with demo data
- **Proper Nginx configuration** with SSL (if requested)
- **PM2 process management** for the application
- **No Docker conflicts** (if Docker cleanup was used)

## 🔐 Default Credentials

After any cleanup and fresh installation:
- **URL**: `https://salessync.gonxt.tech`
- **Email**: `admin@demo.com`
- **Password**: `admin123`

## 🆘 If Cleanup Fails

If the cleanup scripts encounter issues:

1. **Check the logs** - Scripts provide detailed logging
2. **Run manually** - You can run individual sections of the script
3. **Contact support** - Provide the error logs for assistance

## 📞 Support Commands

After cleanup, use these commands to manage your installation:

```bash
# Check application status
sudo pm2 status

# View application logs
sudo pm2 logs salessync-backend

# Restart application
sudo pm2 restart salessync-backend

# Check system services
sudo systemctl status nginx postgresql

# Test application health
curl -I http://localhost:3000/health
```

---

**💡 Pro Tip**: For servers with persistent issues or multiple failed deployments, the Nuclear Reset option is often the fastest path to a working installation.