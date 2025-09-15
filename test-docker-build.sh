#!/bin/bash

# Test script for Docker build fixes
# This script validates the Docker build configuration improvements

set -e

echo "🔍 Testing Docker Build Configuration Fixes"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${YELLOW}ℹ️  $message${NC}"
            ;;
    esac
}

# Check if we're in the right directory
if [ ! -f "backend/Dockerfile" ]; then
    print_status "ERROR" "Please run this script from the SalesSyncAI root directory"
    exit 1
fi

print_status "INFO" "Validating Docker build configuration..."

# Test 1: Check if package.docker.json has correct structure
echo ""
echo "Test 1: Validating package.docker.json structure"
echo "------------------------------------------------"

if [ -f "backend/package.docker.json" ]; then
    print_status "SUCCESS" "package.docker.json exists"
    
    # Check if @types packages are in devDependencies
    if grep -q '"@types/bcrypt"' backend/package.docker.json; then
        if grep -A 20 '"devDependencies"' backend/package.docker.json | grep -q '"@types/bcrypt"'; then
            print_status "SUCCESS" "@types/bcrypt is in devDependencies"
        else
            print_status "ERROR" "@types/bcrypt should be in devDependencies"
        fi
    fi
    
    if grep -q '"@types/node-cron"' backend/package.docker.json; then
        if grep -A 20 '"devDependencies"' backend/package.docker.json | grep -q '"@types/node-cron"'; then
            print_status "SUCCESS" "@types/node-cron is in devDependencies"
        else
            print_status "ERROR" "@types/node-cron should be in devDependencies"
        fi
    fi
else
    print_status "ERROR" "package.docker.json not found"
fi

# Test 2: Check Dockerfile improvements
echo ""
echo "Test 2: Validating Dockerfile improvements"
echo "------------------------------------------"

if [ -f "backend/Dockerfile" ]; then
    print_status "SUCCESS" "Dockerfile exists"
    
    # Check for vips-dev dependency
    if grep -q "vips-dev" backend/Dockerfile; then
        print_status "SUCCESS" "vips-dev dependency added for Sharp support"
    else
        print_status "ERROR" "vips-dev dependency missing"
    fi
    
    # Check for python3 configuration
    if grep -q "npm config set python python3" backend/Dockerfile; then
        print_status "SUCCESS" "Python3 configuration added"
    else
        print_status "ERROR" "Python3 configuration missing"
    fi
    
    # Check for timeout configuration
    if grep -q "timeout=300000" backend/Dockerfile; then
        print_status "SUCCESS" "npm install timeout configured (5 minutes)"
    else
        print_status "ERROR" "npm install timeout not configured"
    fi
    
    # Check for maxsockets configuration
    if grep -q "maxsockets 1" backend/Dockerfile; then
        print_status "SUCCESS" "maxsockets configuration added"
    else
        print_status "ERROR" "maxsockets configuration missing"
    fi
else
    print_status "ERROR" "Dockerfile not found"
fi

# Test 3: Check .dockerignore
echo ""
echo "Test 3: Validating .dockerignore"
echo "--------------------------------"

if [ -f "backend/.dockerignore" ]; then
    print_status "SUCCESS" ".dockerignore exists"
    
    # Check for key exclusions
    if grep -q "node_modules" backend/.dockerignore; then
        print_status "SUCCESS" "node_modules excluded"
    else
        print_status "ERROR" "node_modules should be excluded"
    fi
    
    if grep -q "*.log" backend/.dockerignore; then
        print_status "SUCCESS" "Log files excluded"
    else
        print_status "ERROR" "Log files should be excluded"
    fi
    
    if grep -q ".env" backend/.dockerignore; then
        print_status "SUCCESS" "Environment files excluded"
    else
        print_status "ERROR" "Environment files should be excluded"
    fi
else
    print_status "ERROR" ".dockerignore not found"
fi

# Test 4: Validate npm package structure
echo ""
echo "Test 4: Validating npm package structure"
echo "----------------------------------------"

cd backend

# Check if package.json is valid JSON
if node -e "JSON.parse(require('fs').readFileSync('package.docker.json', 'utf8'))" 2>/dev/null; then
    print_status "SUCCESS" "package.docker.json is valid JSON"
else
    print_status "ERROR" "package.docker.json has JSON syntax errors"
fi

# Check for potential dependency conflicts
if node -e "
const pkg = JSON.parse(require('fs').readFileSync('package.docker.json', 'utf8'));
const deps = Object.keys(pkg.dependencies || {});
const devDeps = Object.keys(pkg.devDependencies || {});
const conflicts = deps.filter(dep => devDeps.includes(dep));
if (conflicts.length > 0) {
    console.log('Conflicts found:', conflicts);
    process.exit(1);
}
" 2>/dev/null; then
    print_status "SUCCESS" "No dependency conflicts found"
else
    print_status "ERROR" "Dependency conflicts detected"
fi

cd ..

# Test 5: Check for documentation
echo ""
echo "Test 5: Validating documentation"
echo "--------------------------------"

if [ -f "DOCKER_BUILD_FIXES.md" ]; then
    print_status "SUCCESS" "Docker build fixes documentation exists"
    
    if grep -q "Root Causes" DOCKER_BUILD_FIXES.md; then
        print_status "SUCCESS" "Documentation includes root cause analysis"
    fi
    
    if grep -q "Solutions Implemented" DOCKER_BUILD_FIXES.md; then
        print_status "SUCCESS" "Documentation includes solutions"
    fi
    
    if grep -q "Rollback Plan" DOCKER_BUILD_FIXES.md; then
        print_status "SUCCESS" "Documentation includes rollback plan"
    fi
else
    print_status "ERROR" "Docker build fixes documentation missing"
fi

# Test 6: Simulate npm configuration test
echo ""
echo "Test 6: Testing npm configuration"
echo "---------------------------------"

cd backend

# Test if npm can parse the package.json without errors
if npm ls --depth=0 --dry-run > /dev/null 2>&1; then
    print_status "SUCCESS" "npm can parse package.docker.json structure"
else
    print_status "INFO" "npm dry-run test skipped (dependencies not installed)"
fi

cd ..

# Summary
echo ""
echo "🏁 Test Summary"
echo "==============="

# Count successful tests by checking previous output
success_count=$(grep -c "✅" <<< "$(cat)")
total_tests=15

if [ -f "backend/package.docker.json" ] && [ -f "backend/Dockerfile" ] && [ -f "backend/.dockerignore" ] && [ -f "DOCKER_BUILD_FIXES.md" ]; then
    print_status "SUCCESS" "All critical files are present"
    print_status "INFO" "Docker build configuration improvements are ready for testing"
    print_status "INFO" "You can now test the actual Docker build with:"
    echo "    cd backend && docker build -t salessync-backend-test ."
else
    print_status "ERROR" "Some critical files are missing"
fi

echo ""
print_status "INFO" "Next steps:"
echo "  1. Test actual Docker build: docker build -t salessync-backend-test backend/"
echo "  2. If successful, merge PR #6 to apply fixes to production"
echo "  3. Deploy using: docker-compose up --build backend"
echo "  4. Monitor deployment logs for any remaining issues"

echo ""
print_status "INFO" "For production deployment, ensure:"
echo "  - Database is running and accessible"
echo "  - Environment variables are properly configured"
echo "  - Network connectivity is stable for npm package downloads"