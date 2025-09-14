# Quick Setup Commands for SalesSync AI

## 🚀 One-Line Setup (Recommended)

Run this single command to set up SalesSync AI in your user directory:

```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/setup-user-fixed.sh | sudo bash
```

## 🔧 Manual Setup (If one-liner doesn't work)

```bash
# Download the fixed setup script
sudo curl -O https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/setup-user-fixed.sh

# Make it executable
sudo chmod +x setup-user-fixed.sh

# Run it
sudo ./setup-user-fixed.sh
```

## 📍 What This Does

1. ✅ **Detects your actual user** (even when run with sudo)
2. ✅ **Clones to ~/SalesSyncAI** (your user directory)
3. ✅ **Fixes all permissions** automatically
4. ✅ **Installs Docker** if needed
5. ✅ **Adds you to docker group**
6. ✅ **Sets up environment** files
7. ✅ **Creates convenience alias** (`salessync` command)
8. ✅ **Creates desktop shortcut**

## 🚀 After Setup

1. **Log out and log back in** (for Docker group changes)
2. **Navigate to project**: `cd ~/SalesSyncAI` or use `salessync`
3. **Deploy**: `./deploy-simple.sh`

## 🌐 Your App Will Be Available At

- http://ssai.gonxt.tech
- https://ssai.gonxt.tech (after SSL setup)

## 🔍 If You Have Issues

### Permission Denied Errors
```bash
# Fix ownership
sudo chown -R $USER:$USER ~/SalesSyncAI

# Fix script permissions
find ~/SalesSyncAI -name "*.sh" -exec chmod +x {} \;
```

### Docker Permission Issues
```bash
# Add yourself to docker group
sudo usermod -aG docker $USER

# Log out and log back in, then test
docker ps
```

### Directory Already Exists
```bash
# Remove and start fresh
rm -rf ~/SalesSyncAI

# Run setup again
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/setup-user-fixed.sh | sudo bash
```

## 📊 Quick Commands After Setup

```bash
# Navigate to project
salessync  # or cd ~/SalesSyncAI

# Deploy application
./deploy-simple.sh

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services
docker-compose down
```

## 🎯 Why This Approach?

- ✅ **User-friendly**: No need for /opt directory
- ✅ **Secure**: Proper user permissions
- ✅ **Easy management**: Standard user operations
- ✅ **Development ready**: Easy to edit and update
- ✅ **Backup friendly**: In user space

## 🔒 Security Notes

- Script runs with sudo only for Docker installation and user group management
- All files are owned by your user account
- No system-wide changes except Docker setup
- Follows Linux security best practices