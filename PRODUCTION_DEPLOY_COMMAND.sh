#!/bin/bash

# 🚀 PRODUCTION DEPLOYMENT COMMAND
# Execute this on the AWS t3g.medium Ubuntu server

echo "🚀 DEPLOYING SALESSYNC FIXES TO PRODUCTION"
echo "=========================================="

# Download and execute the comprehensive deployment script
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/DEPLOY_ALL_FIXES_NOW.sh -o deploy_fixes.sh
chmod +x deploy_fixes.sh
./deploy_fixes.sh

echo ""
echo "🎉 DEPLOYMENT COMPLETED!"
echo "🌐 Test at: https://ss.gonxt.tech"
echo "🔑 Demo Login: admin@salessync.com / admin123"