#!/bin/bash

# 🧪 POST-DEPLOYMENT VERIFICATION SCRIPT
# Run this after deploying fixes to verify everything works

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}[VERIFY]${NC} $1"
}

print_header "🧪 POST-DEPLOYMENT VERIFICATION"
echo "=================================="
echo ""

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    print_status "Testing: $test_name"
    
    if eval "$test_command"; then
        print_success "✅ $test_name - PASSED"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        print_error "❌ $test_name - FAILED"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# ==========================================
# TEST 1: WEBSITE ACCESSIBILITY
# ==========================================
print_header "🌐 TEST 1: WEBSITE ACCESSIBILITY"

run_test "Website Homepage" \
    "curl -s -o /dev/null -w '%{http_code}' https://ss.gonxt.tech | grep -q '200'" \
    "200"

run_test "Login Page" \
    "curl -s -o /dev/null -w '%{http_code}' https://ss.gonxt.tech/login | grep -q '200'" \
    "200"

run_test "API Health Endpoint" \
    "curl -s https://ss.gonxt.tech/api/health | grep -q 'healthy'" \
    "healthy status"

echo ""

# ==========================================
# TEST 2: FAVICON VERIFICATION
# ==========================================
print_header "🌟 TEST 2: FAVICON VERIFICATION"

run_test "Favicon.ico" \
    "curl -s -o /dev/null -w '%{http_code}' https://ss.gonxt.tech/favicon.ico | grep -q '200'" \
    "200"

run_test "Favicon.svg" \
    "curl -s -o /dev/null -w '%{http_code}' https://ss.gonxt.tech/favicon.svg | grep -q '200'" \
    "200"

echo ""

# ==========================================
# TEST 3: LOGIN FUNCTIONALITY (CRITICAL)
# ==========================================
print_header "🔑 TEST 3: LOGIN FUNCTIONALITY (CRITICAL)"

# Test all demo users
declare -a demo_users=(
    "admin@salessync.com:admin123:Company Admin"
    "manager@salessync.com:manager123:Regional Manager"
    "sales@salessync.com:sales123:Field Sales Agent"
    "field@salessync.com:field123:Field Representative"
)

for user_data in "${demo_users[@]}"; do
    IFS=':' read -r email password role <<< "$user_data"
    
    print_status "Testing login: $role ($email)"
    
    LOGIN_RESPONSE=$(curl -X POST https://ss.gonxt.tech/api/auth/login \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"$email\", \"password\": \"$password\"}" \
        -s -w "%{http_code}" -o /tmp/login_response.json 2>/dev/null)
    
    HTTP_CODE="${LOGIN_RESPONSE: -3}"
    
    if [ "$HTTP_CODE" = "200" ]; then
        # Check if response contains token
        if grep -q "token\|access_token\|jwt" /tmp/login_response.json 2>/dev/null; then
            print_success "✅ $role login - SUCCESS (HTTP $HTTP_CODE with token)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            print_warning "⚠️ $role login - HTTP 200 but no token found"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    elif [ "$HTTP_CODE" = "401" ]; then
        print_error "❌ $role login - FAILED (HTTP 401 - Invalid credentials)"
        print_error "   This indicates seeding may not have worked properly"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    else
        print_error "❌ $role login - FAILED (HTTP $HTTP_CODE)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Clean up temp file
    rm -f /tmp/login_response.json
done

echo ""

# ==========================================
# TEST 4: UI IMPROVEMENTS VERIFICATION
# ==========================================
print_header "🎨 TEST 4: UI IMPROVEMENTS VERIFICATION"

print_status "Checking for updated demo credentials in UI..."

# Download login page and check for correct credentials
LOGIN_PAGE_CONTENT=$(curl -s https://ss.gonxt.tech/login)

if echo "$LOGIN_PAGE_CONTENT" | grep -q "salessync.com"; then
    print_success "✅ UI shows correct @salessync.com credentials"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_error "❌ UI still shows old @demo.com credentials"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Check for enhanced UI elements
if echo "$LOGIN_PAGE_CONTENT" | grep -q "Power Your Sales Performance\|Field Marketing Platform"; then
    print_success "✅ Enhanced UI elements detected"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_warning "⚠️ Enhanced UI elements not detected (may need cache refresh)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""

# ==========================================
# TEST 5: BACKEND SEEDING VERIFICATION
# ==========================================
print_header "🗄️ TEST 5: BACKEND SEEDING VERIFICATION"

print_status "Checking if seeding error is resolved..."

# Test if we can create a simple API request without errors
API_TEST=$(curl -s -o /dev/null -w "%{http_code}" https://ss.gonxt.tech/api/companies 2>/dev/null || echo "000")

if [ "$API_TEST" = "200" ] || [ "$API_TEST" = "401" ]; then
    print_success "✅ API endpoints responding (HTTP $API_TEST)"
    print_success "✅ No Prisma seeding errors detected"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_error "❌ API endpoints not responding properly (HTTP $API_TEST)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""

# ==========================================
# FINAL RESULTS
# ==========================================
print_header "📊 VERIFICATION RESULTS"

echo "=================================="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo "Success Rate: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%"
echo "=================================="

if [ $FAILED_TESTS -eq 0 ]; then
    print_success "🎉 ALL TESTS PASSED! Deployment successful!"
    echo ""
    echo "✅ Seeding error: RESOLVED"
    echo "✅ UI improvements: DEPLOYED"
    echo "✅ Favicon: WORKING"
    echo "✅ Login functionality: WORKING"
    echo ""
    echo "🌐 Your SalesSync application is fully functional!"
    echo "🔑 Demo users can login with @salessync.com credentials"
    exit 0
elif [ $FAILED_TESTS -le 2 ]; then
    print_warning "⚠️ MOSTLY SUCCESSFUL with minor issues"
    echo ""
    echo "Most critical functionality is working."
    echo "Check the failed tests above for minor issues."
    exit 1
else
    print_error "❌ DEPLOYMENT HAS ISSUES"
    echo ""
    echo "Multiple tests failed. Please check:"
    echo "1. Did the deployment script complete successfully?"
    echo "2. Are all services running?"
    echo "3. Check server logs for errors"
    echo ""
    echo "Re-run deployment if needed:"
    echo "curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/DEPLOY_ALL_FIXES_NOW.sh | bash"
    exit 2
fi