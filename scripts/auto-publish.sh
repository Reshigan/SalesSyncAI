#!/bin/bash

# SalesSync Auto-Publish Script
# Automatically commits and pushes changes to GitHub main branch

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 SalesSync Auto-Publish Script${NC}"
echo -e "${BLUE}=================================${NC}"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check if there are any changes
if git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  No changes detected. Nothing to publish.${NC}"
    exit 0
fi

# Get current timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Check if a custom commit message was provided
if [ -n "$1" ]; then
    COMMIT_MESSAGE="$1"
else
    # Generate automatic commit message based on changes
    ADDED_FILES=$(git diff --cached --name-only --diff-filter=A | wc -l)
    MODIFIED_FILES=$(git diff --cached --name-only --diff-filter=M | wc -l)
    DELETED_FILES=$(git diff --cached --name-only --diff-filter=D | wc -l)
    
    COMMIT_MESSAGE="Auto-update: ${ADDED_FILES} added, ${MODIFIED_FILES} modified, ${DELETED_FILES} deleted - ${TIMESTAMP}"
fi

echo -e "${YELLOW}📝 Staging all changes...${NC}"
git add .

echo -e "${YELLOW}📊 Changes to be committed:${NC}"
git status --porcelain

echo -e "${YELLOW}💾 Committing changes...${NC}"
git commit -m "${COMMIT_MESSAGE}

Co-authored-by: openhands <openhands@all-hands.dev>"

echo -e "${YELLOW}🌐 Pushing to GitHub main branch...${NC}"
git push origin main

echo -e "${GREEN}✅ Successfully published to GitHub!${NC}"
echo -e "${GREEN}📍 Repository: https://github.com/Reshigan/SalesSyncAI${NC}"
echo -e "${GREEN}🕒 Published at: ${TIMESTAMP}${NC}"

# Optional: Show the latest commit
echo -e "${BLUE}📋 Latest commit:${NC}"
git log -1 --oneline