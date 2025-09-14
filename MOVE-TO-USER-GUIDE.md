# Moving SalesSync AI to User Directory

This guide helps you move SalesSync AI from `/opt/salessync` to your user's home directory for better permissions and easier management.

## 🎯 Why Move to User Directory?

- ✅ **Better Permissions**: No need for sudo for most operations
- ✅ **Easier Management**: Standard user access to files
- ✅ **Safer Operations**: Reduced risk of system-wide changes
- ✅ **Development Friendly**: Easier to edit files and manage code

## 🚀 Option 1: Move Existing Installation

If you already have SalesSync AI in `/opt/salessync`:

```bash
# Download the move script
curl -O https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/move-to-user.sh
chmod +x move-to-user.sh

# Run the move script
./move-to-user.sh
```

### What the Move Script Does:

1. **Stops running services** safely
2. **Copies directory** from `/opt/salessync` to `~/SalesSyncAI`
3. **Changes ownership** to your user account
4. **Updates configurations** with new paths
5. **Sets proper permissions** on all files
6. **Updates systemd services** if they exist
7. **Starts services** in new location
8. **Adds convenience alias** for quick access

## 🆕 Option 2: Fresh Setup in User Directory

If you want a clean installation directly in your user directory:

```bash
# Download and run the setup script
curl -O https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/setup-user-directory.sh
chmod +x setup-user-directory.sh
./setup-user-directory.sh
```

### What the Setup Script Does:

1. **Clones repository** directly to `~/SalesSyncAI`
2. **Installs Docker** if not present
3. **Configures user permissions** for Docker
4. **Sets up environment** files
5. **Creates convenience alias** and shortcuts
6. **Prepares for deployment**

## 📍 New Directory Structure

After moving, your project will be located at:
```
~/SalesSyncAI/
├── backend/
├── frontend/
├── nginx/
├── docker-compose.yml
├── .env.production
├── deploy-simple.sh
└── ... (all other files)
```

## 🔧 Post-Move Operations

### Quick Access
```bash
# Use the new alias (after restarting terminal)
salessync

# Or navigate manually
cd ~/SalesSyncAI
```

### Deploy Application
```bash
cd ~/SalesSyncAI
./deploy-simple.sh
```

### Manage Services
```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services
docker-compose down
```

## 🔐 Permissions & Security

### User Permissions
- All files owned by your user account
- No sudo required for file operations
- Docker group membership for container management

### File Permissions
- Scripts: `755` (executable)
- Config files: `644` (readable)
- Directories: `755` (accessible)

## 🧹 Cleanup Old Installation

After verifying everything works in the new location:

```bash
# Remove old directory (be careful!)
sudo rm -rf /opt/salessync

# Remove old systemd services if they exist
sudo systemctl disable salessync.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/salessync*.service
sudo systemctl daemon-reload
```

## 🔍 Troubleshooting

### Docker Permission Issues
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and log back in, then test
docker ps
```

### Service Not Starting
```bash
# Check logs
docker-compose logs [service-name]

# Rebuild containers
docker-compose down
docker-compose up -d --build
```

### File Permission Issues
```bash
# Fix ownership
sudo chown -R $USER:$USER ~/SalesSyncAI

# Fix script permissions
find ~/SalesSyncAI -name "*.sh" -exec chmod +x {} \;
```

## 📊 Comparison: /opt vs User Directory

| Aspect | /opt/salessync | ~/SalesSyncAI |
|--------|----------------|---------------|
| **Permissions** | Requires sudo | User-owned |
| **Security** | System-wide | User-scoped |
| **Backup** | Manual/root | User backup tools |
| **Development** | Harder to edit | Easy to modify |
| **Updates** | Requires sudo | User can update |
| **Logs** | Root access needed | User accessible |

## 🎯 Recommended Workflow

1. **Move/Setup** in user directory
2. **Deploy** using `./deploy-simple.sh`
3. **Configure SSL** with Let's Encrypt
4. **Set up monitoring** and backups
5. **Regular updates** via git pull

## 📞 Support

If you encounter issues during the move:

1. **Check logs**: `docker-compose logs -f`
2. **Verify permissions**: `ls -la ~/SalesSyncAI`
3. **Test Docker access**: `docker ps`
4. **Check services**: `docker-compose ps`

## 🌟 Benefits After Move

- ✅ Easier file management
- ✅ Better development workflow  
- ✅ Simplified permissions
- ✅ User-friendly operations
- ✅ Standard Linux practices
- ✅ Easier backups and updates

## 🚀 Next Steps

After moving to user directory:

1. **Deploy**: `./deploy-simple.sh`
2. **Configure SSL**: `sudo certbot --nginx -d ssai.gonxt.tech`
3. **Test application**: Visit `https://ssai.gonxt.tech`
4. **Set up monitoring**: Use provided monitoring scripts
5. **Regular maintenance**: Keep system updated