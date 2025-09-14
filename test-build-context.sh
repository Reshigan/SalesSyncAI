#!/bin/bash

# Test Docker build context for SalesSync AI

echo "🔍 Testing Docker build contexts..."

echo
echo "📁 Frontend directory structure:"
echo "================================"
ls -la frontend/
echo
echo "📄 Frontend public directory:"
ls -la frontend/public/
echo
echo "📄 Frontend src directory:"
ls -la frontend/src/
echo

echo "📁 Backend directory structure:"
echo "==============================="
ls -la backend/
echo
echo "📄 Backend src directory:"
ls -la backend/src/
echo

echo "🐳 Testing frontend Docker build context..."
echo "============================================"
cd frontend
docker build -f Dockerfile.prod -t test-frontend-context . --no-cache --progress=plain 2>&1 | head -20
cd ..

echo
echo "🐳 Testing backend Docker build context..."
echo "=========================================="
cd backend
docker build -f Dockerfile -t test-backend-context . --no-cache --progress=plain 2>&1 | head -20
cd ..

echo
echo "✅ Build context test complete!"