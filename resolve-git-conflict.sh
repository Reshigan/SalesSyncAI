#!/bin/bash

echo "🔧 Resolving Git Conflicts..."

# Reset any ongoing merge
git merge --abort 2>/dev/null || echo "No merge to abort"
git rebase --abort 2>/dev/null || echo "No rebase to abort"

# Stash any local changes
echo "📦 Stashing local changes..."
git stash push -m "Local changes before pull" 2>/dev/null || echo "Nothing to stash"

# Force pull latest changes
echo "⬇️ Force pulling latest changes..."
git fetch origin main
git reset --hard origin/main

echo "✅ Git conflicts resolved!"
echo "📁 Files are now up to date"

# List available scripts
echo ""
echo "🛠️ Available fix scripts:"
ls -la *.sh | grep -E "(fix|emergency)" || echo "Scripts will be available after git pull"