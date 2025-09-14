# SalesSync AI Deployment Usage Guide

## Quick Deployment Options

### Option 1: Live Production Deployment (Recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/live-deployment.sh | bash
```

**Important:** Run this command as a regular user (not with sudo). The script will request sudo privileges when needed.

### Option 2: If you need to run with sudo
```bash
# First authenticate sudo
sudo -v

# Then run the script
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/live-deployment.sh | bash
```

## What the Script Does

1. **System Setup**: Installs Node.js 18, PostgreSQL 15, Redis, and other dependencies
2. **Repository**: Clones the latest SalesSync AI code
3. **Backend**: Sets up the API server with database migrations
4. **Frontend**: Builds the React application
5. **Services**: Creates systemd services for automatic startup
6. **Verification**: Tests all components and connections

## After Deployment

Your SalesSync AI application will be running with:

- **Backend API**: http://localhost:12000
- **Frontend App**: http://localhost:8080
- **Database**: PostgreSQL with 28+ tables
- **Cache**: Redis server

## Service Management

```bash
# Check service status
sudo systemctl status salessync-backend
sudo systemctl status salessync-frontend

# View logs
sudo journalctl -u salessync-backend -f
sudo journalctl -u salessync-frontend -f

# Restart services
sudo systemctl restart salessync-backend
sudo systemctl restart salessync-frontend

# Stop services
sudo systemctl stop salessync-backend salessync-frontend
```

## Troubleshooting

### If deployment fails with permission errors:
1. Make sure you're running as a regular user (not root)
2. Ensure your user has sudo privileges
3. Try running `sudo -v` first to authenticate

### If services don't start:
1. Check logs: `sudo journalctl -u salessync-backend -n 50`
2. Verify database is running: `sudo systemctl status postgresql`
3. Check Redis: `sudo systemctl status redis-server`

### If you need to redeploy:
```bash
# Stop existing services
sudo systemctl stop salessync-backend salessync-frontend

# Remove installation
sudo rm -rf /opt/salessync

# Run deployment script again
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/live-deployment.sh | bash
```

## Security Notes

- The script follows security best practices
- Services run as non-root users
- Database uses local connections only
- All components are properly isolated

## Support

For issues or questions:
1. Check the logs first
2. Review the [LIVE_DEPLOYMENT_GUIDE.md](LIVE_DEPLOYMENT_GUIDE.md) for detailed troubleshooting
3. Open an issue on GitHub

---

**Version**: 1.0.0  
**Last Updated**: 2025-09-14  
**Tested On**: Ubuntu 22.04 LTS