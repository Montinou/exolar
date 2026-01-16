#!/bin/bash
# Test script for dashboard filter consistency endpoints
# Usage: ./scripts/test-preview-endpoints.sh <preview-url>

set -e

PREVIEW_URL="${1:-https://exolar-git-fix-dashbo-eb5589-agustin-montoyas-projects-554f9f37.vercel.app}"
EMAIL="agustin.montoya@distillery.com"
PASSWORD="btcStn60"

echo "=========================================="
echo "Testing Dashboard Filter Consistency"
echo "Preview URL: $PREVIEW_URL"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local endpoint="$2"
    local expected_fields="$3"

    echo -n "Testing $name... "

    response=$(curl -s -w "\n%{http_code}" "$PREVIEW_URL$endpoint" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        # Check if response contains expected fields
        if echo "$body" | grep -q "$expected_fields" 2>/dev/null; then
            echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
            echo "  Response preview: $(echo "$body" | head -c 200)..."
        else
            echo -e "${YELLOW}⚠ PARTIAL${NC} (HTTP $http_code, missing expected fields)"
            echo "  Response: $(echo "$body" | head -c 300)"
        fi
    elif [ "$http_code" = "401" ]; then
        echo -e "${YELLOW}⚠ AUTH REQUIRED${NC} (HTTP $http_code)"
        echo "  Note: Endpoint requires authentication"
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "  Response: $(echo "$body" | head -c 200)"
    fi
    echo ""
}

echo "1. SLOWEST TESTS ENDPOINT"
echo "========================="

echo "Test 1a: Default (15 days)"
test_endpoint "slowest-tests (default)" "/api/slowest-tests?limit=3" "tests"

echo "Test 1b: With date filter"
test_endpoint "slowest-tests (with from)" "/api/slowest-tests?limit=3&from=2025-01-01" "filters"

echo "Test 1c: With branch filter"
test_endpoint "slowest-tests (with branch)" "/api/slowest-tests?limit=3&branch=main" "branch"

echo ""
echo "2. SUITE PASS RATES ENDPOINT"
echo "============================"

echo "Test 2a: Default (15 days)"
test_endpoint "suite-pass-rates (default)" "/api/suite-pass-rates" "suites"

echo "Test 2b: With date filter"
test_endpoint "suite-pass-rates (with from)" "/api/suite-pass-rates?from=2025-01-01" "filters"

echo "Test 2c: With branch filter"
test_endpoint "suite-pass-rates (with branch)" "/api/suite-pass-rates?branch=main" "branch"

echo ""
echo "3. ERROR DISTRIBUTION ENDPOINT"
echo "=============================="

echo "Test 3a: Default (15 days)"
test_endpoint "error-distribution (default)" "/api/error-distribution" "distribution"

echo "Test 3b: With since filter"
test_endpoint "error-distribution (with since)" "/api/error-distribution?since=2025-01-01" "filters"

echo "Test 3c: With branch filter"
test_endpoint "error-distribution (with branch)" "/api/error-distribution?branch=main" "branch"

echo ""
echo "4. COMBINED FILTERS TEST"
echo "========================"

echo "Test 4a: All filters combined - slowest-tests"
test_endpoint "slowest-tests (all filters)" "/api/slowest-tests?limit=5&from=2025-01-01&to=2025-01-15&branch=main" "filters"

echo "Test 4b: All filters combined - suite-pass-rates"
test_endpoint "suite-pass-rates (all filters)" "/api/suite-pass-rates?from=2025-01-01&to=2025-01-15&branch=main" "filters"

echo ""
echo "=========================================="
echo "Testing Complete"
echo "=========================================="
