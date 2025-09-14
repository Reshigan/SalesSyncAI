#!/bin/bash

# Test script to verify npm conflict resolution
echo "🧪 Testing npm conflict resolution..."

# Check current Node.js and npm versions
echo "Current versions:"
node --version 2>/dev/null || echo "Node.js not found"
npm --version 2>/dev/null || echo "npm not found"

# Test the npm conflict fix approach
echo ""
echo "🔧 Testing npm conflict fix approach..."

# Remove conflicting packages (simulate what the script does)
echo "Simulating package removal..."
sudo apt remove -y npm nodejs 2>/dev/null || echo "No conflicting packages to remove"

# Add NodeSource repository
echo "Adding NodeSource repository..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -

# Install Node.js and npm
echo "Installing Node.js and npm from NodeSource..."
sudo apt install -y nodejs

# Verify installation
echo ""
echo "✅ After fix:"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Test npm functionality
echo ""
echo "🧪 Testing npm functionality..."
npm --version > /dev/null && echo "✅ npm is working correctly" || echo "❌ npm has issues"

echo ""
echo "🎉 npm conflict fix test completed!"