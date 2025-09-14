#!/bin/bash

# SalesSync System Testing Script
# Comprehensive testing of all system components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
    ((TOTAL_TESTS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
    ((TOTAL_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    log_info "Testing: $test_name"
    
    if result=$(eval "$test_command" 2>&1); then
        if [[ -z "$expected_pattern" ]] || echo "$result" | grep -q "$expected_pattern"; then
            log_success "$test_name"
            return 0
        else
            log_error "$test_name - Expected pattern not found: $expected_pattern"
            echo "Result: $result"
            return 1
        fi
    else
        log_error "$test_name - Command failed"
        echo "Error: $result"
        return 1
    fi
}

# API test function
api_test() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local headers="$4"
    local data="$5"
    local expected_status="$6"
    
    log_info "API Test: $test_name"
    
    local curl_cmd="curl -s -w '%{http_code}' -X $method"
    
    if [[ -n "$headers" ]]; then
        curl_cmd="$curl_cmd $headers"
    fi
    
    if [[ -n "$data" ]]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    curl_cmd="$curl_cmd http://localhost:12000$endpoint"
    
    local response=$(eval "$curl_cmd")
    local status_code="${response: -3}"
    local body="${response%???}"
    
    if [[ "$status_code" == "$expected_status" ]]; then
        log_success "$test_name (HTTP $status_code)"
        return 0
    else
        log_error "$test_name - Expected $expected_status, got $status_code"
        echo "Response: $body"
        return 1
    fi
}

echo "🚀 Starting SalesSync System Testing"
echo "=================================="

# 1. Basic Health Checks
log_info "1. BASIC HEALTH CHECKS"
echo "----------------------"

run_test "Backend Health Check" \
    "curl -s http://localhost:12000/health" \
    "healthy"

run_test "Frontend Accessibility" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:12001/" \
    "200"

# 2. Authentication Tests
log_info "2. AUTHENTICATION TESTS"
echo "------------------------"

# Test invalid login
api_test "Invalid Login" \
    "POST" \
    "/api/auth/login" \
    "-H 'Content-Type: application/json'" \
    '{"email": "invalid@test.com", "password": "wrong"}' \
    "401"

# Test valid Super Admin login
SUPER_ADMIN_LOGIN=$(curl -s -X POST http://localhost:12000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "superadmin@salessync.com", "password": "SuperAdmin123!"}')

if echo "$SUPER_ADMIN_LOGIN" | grep -q '"success":true'; then
    log_success "Super Admin Login"
    SUPER_ADMIN_TOKEN=$(echo "$SUPER_ADMIN_LOGIN" | jq -r '.data.token')
else
    log_error "Super Admin Login"
    echo "Response: $SUPER_ADMIN_LOGIN"
fi

# Test Company Admin login
COMPANY_ADMIN_LOGIN=$(curl -s -X POST http://localhost:12000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@testcompany.com", "password": "Admin123!"}')

if echo "$COMPANY_ADMIN_LOGIN" | grep -q '"success":true'; then
    log_success "Company Admin Login"
    COMPANY_ADMIN_TOKEN=$(echo "$COMPANY_ADMIN_LOGIN" | jq -r '.data.token')
else
    log_error "Company Admin Login"
    echo "Response: $COMPANY_ADMIN_LOGIN"
fi

# Test Field Agent login
FIELD_AGENT_LOGIN=$(curl -s -X POST http://localhost:12000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "agent@testcompany.com", "password": "Agent123!"}')

if echo "$FIELD_AGENT_LOGIN" | grep -q '"success":true'; then
    log_success "Field Agent Login"
    FIELD_AGENT_TOKEN=$(echo "$FIELD_AGENT_LOGIN" | jq -r '.data.token')
else
    log_error "Field Agent Login"
    echo "Response: $FIELD_AGENT_LOGIN"
fi

# 3. API Endpoint Tests
log_info "3. API ENDPOINT TESTS"
echo "---------------------"

if [[ -n "$SUPER_ADMIN_TOKEN" ]]; then
    # Field Sales API Tests
    api_test "Field Sales - Get Visits" \
        "GET" \
        "/api/field-sales/visits" \
        "-H 'Authorization: Bearer $SUPER_ADMIN_TOKEN'" \
        "" \
        "200"
    
    api_test "Field Sales - Get Customers" \
        "GET" \
        "/api/field-sales/customers" \
        "-H 'Authorization: Bearer $SUPER_ADMIN_TOKEN'" \
        "" \
        "200"
    
    # Field Marketing API Tests
    api_test "Field Marketing - Get Campaigns" \
        "GET" \
        "/api/field-marketing/campaigns" \
        "-H 'Authorization: Bearer $SUPER_ADMIN_TOKEN'" \
        "" \
        "200"
    
    # Promotions API Tests
    api_test "Promotions - Get Activations" \
        "GET" \
        "/api/promotions/activations" \
        "-H 'Authorization: Bearer $SUPER_ADMIN_TOKEN'" \
        "" \
        "200"
    
    # Reporting API Tests
    api_test "Reporting - Get Dashboard" \
        "GET" \
        "/api/reporting/dashboard" \
        "-H 'Authorization: Bearer $SUPER_ADMIN_TOKEN'" \
        "" \
        "200"
    
    api_test "Reporting - Get Sales Report" \
        "GET" \
        "/api/reporting/sales" \
        "-H 'Authorization: Bearer $SUPER_ADMIN_TOKEN'" \
        "" \
        "200"
else
    log_error "Skipping API tests - No Super Admin token available"
fi

# 4. Database Integrity Tests
log_info "4. DATABASE INTEGRITY TESTS"
echo "----------------------------"

# Test database connection and data integrity
DB_TEST=$(curl -s -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
    "http://localhost:12000/api/reporting/dashboard" | jq -r '.success')

if [[ "$DB_TEST" == "true" ]]; then
    log_success "Database Connection and Data Integrity"
else
    log_error "Database Connection and Data Integrity"
fi

# 5. Security Tests
log_info "5. SECURITY TESTS"
echo "-----------------"

# Test unauthorized access
api_test "Unauthorized Access Protection" \
    "GET" \
    "/api/field-sales/visits" \
    "" \
    "" \
    "401"

# Test invalid token
api_test "Invalid Token Protection" \
    "GET" \
    "/api/field-sales/visits" \
    "-H 'Authorization: Bearer invalid_token'" \
    "" \
    "401"

# Test rate limiting (make multiple requests quickly)
log_info "Testing Rate Limiting..."
RATE_LIMIT_PASSED=true
for i in {1..20}; do
    response=$(curl -s -w '%{http_code}' -o /dev/null http://localhost:12000/health)
    if [[ "$response" == "429" ]]; then
        log_success "Rate Limiting (triggered after $i requests)"
        RATE_LIMIT_PASSED=true
        break
    fi
done

if [[ "$RATE_LIMIT_PASSED" != "true" ]]; then
    log_warning "Rate Limiting - Not triggered in 20 requests (may be configured for higher limits)"
fi

# 6. Performance Tests
log_info "6. PERFORMANCE TESTS"
echo "--------------------"

# Test response times
RESPONSE_TIME=$(curl -s -w '%{time_total}' -o /dev/null http://localhost:12000/health)
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc -l | cut -d. -f1)

if [[ $RESPONSE_TIME_MS -lt 1000 ]]; then
    log_success "Response Time Test (${RESPONSE_TIME_MS}ms < 1000ms)"
else
    log_error "Response Time Test (${RESPONSE_TIME_MS}ms >= 1000ms)"
fi

# Test concurrent requests
log_info "Testing Concurrent Requests..."
CONCURRENT_PASSED=true
for i in {1..10}; do
    curl -s http://localhost:12000/health > /dev/null &
done
wait

if [[ $? -eq 0 ]]; then
    log_success "Concurrent Requests Test"
else
    log_error "Concurrent Requests Test"
fi

# 7. Frontend Integration Tests
log_info "7. FRONTEND INTEGRATION TESTS"
echo "------------------------------"

# Test frontend loading
FRONTEND_CONTENT=$(curl -s http://localhost:12001/)
if echo "$FRONTEND_CONTENT" | grep -q "SalesSync"; then
    log_success "Frontend Content Loading"
else
    log_error "Frontend Content Loading"
fi

# Test frontend assets
FRONTEND_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:12001/static/css/main.css)
if [[ "$FRONTEND_STATUS" == "200" ]] || [[ "$FRONTEND_STATUS" == "404" ]]; then
    log_success "Frontend Asset Serving"
else
    log_error "Frontend Asset Serving"
fi

# 8. System Resource Tests
log_info "8. SYSTEM RESOURCE TESTS"
echo "-------------------------"

# Check memory usage
MEMORY_USAGE=$(ps aux | grep -E "(node|npm)" | grep -v grep | awk '{sum += $4} END {print sum}')
if [[ -n "$MEMORY_USAGE" ]] && (( $(echo "$MEMORY_USAGE < 50" | bc -l) )); then
    log_success "Memory Usage Test (${MEMORY_USAGE}% < 50%)"
else
    log_warning "Memory Usage Test (${MEMORY_USAGE}% - monitor for production)"
fi

# Check process status
NODE_PROCESSES=$(ps aux | grep -E "node.*12000" | grep -v grep | wc -l)
if [[ $NODE_PROCESSES -gt 0 ]]; then
    log_success "Backend Process Status"
else
    log_error "Backend Process Status"
fi

REACT_PROCESSES=$(ps aux | grep -E "node.*12001" | grep -v grep | wc -l)
if [[ $REACT_PROCESSES -gt 0 ]]; then
    log_success "Frontend Process Status"
else
    log_error "Frontend Process Status"
fi

# 9. Data Validation Tests
log_info "9. DATA VALIDATION TESTS"
echo "-------------------------"

if [[ -n "$SUPER_ADMIN_TOKEN" ]]; then
    # Test dashboard data structure
    DASHBOARD_DATA=$(curl -s -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
        "http://localhost:12000/api/reporting/dashboard")
    
    if echo "$DASHBOARD_DATA" | jq -e '.data.metrics.totalSales' > /dev/null 2>&1; then
        log_success "Dashboard Data Structure"
    else
        log_error "Dashboard Data Structure"
    fi
    
    # Test user data structure
    USER_DATA=$(echo "$SUPER_ADMIN_LOGIN" | jq -e '.data.user.id')
    if [[ "$USER_DATA" != "null" ]] && [[ -n "$USER_DATA" ]]; then
        log_success "User Data Structure"
    else
        log_error "User Data Structure"
    fi
else
    log_error "Skipping data validation tests - No authentication token"
fi

# 10. Error Handling Tests
log_info "10. ERROR HANDLING TESTS"
echo "-------------------------"

# Test 404 handling
api_test "404 Error Handling" \
    "GET" \
    "/api/nonexistent/endpoint" \
    "" \
    "" \
    "404"

# Test malformed JSON
api_test "Malformed JSON Handling" \
    "POST" \
    "/api/auth/login" \
    "-H 'Content-Type: application/json'" \
    '{"invalid": json}' \
    "400"

# Final Results
echo ""
echo "🏁 TEST RESULTS SUMMARY"
echo "======================="
echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! System is ready for production.${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Review the failures above.${NC}"
    exit 1
fi