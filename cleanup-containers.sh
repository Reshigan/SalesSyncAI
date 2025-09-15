#!/bin/bash

echo "🧹 CONTAINER CLEANUP - Removing Conflicting Containers"
echo "This will stop and remove all salessync containers"
echo ""

echo "🛑 Step 1: Stopping all salessync containers..."
docker stop salessync-frontend salessync-backend salessync-postgres salessync-redis salessync-nginx 2>/dev/null || echo "Some containers not running"

echo "🗑️ Step 2: Removing all salessync containers..."
docker rm salessync-frontend salessync-backend salessync-postgres salessync-redis salessync-nginx 2>/dev/null || echo "Some containers not found"

echo "🧹 Step 3: Removing unused volumes..."
docker volume prune -f 2>/dev/null || echo "No volumes to remove"

echo "🧹 Step 4: Removing unused networks..."
docker network prune -f 2>/dev/null || echo "No networks to remove"

echo ""
echo "✅ Cleanup complete! Now you can run:"
echo "docker-compose -f docker-compose.production.yml up -d"
echo ""
echo "📊 Current containers:"
docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep salessync || echo "No salessync containers found"