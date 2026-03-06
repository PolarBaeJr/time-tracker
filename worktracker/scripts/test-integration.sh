#!/bin/bash
#
# Integration Test Runner for WorkTracker
#
# This script runs RLS integration tests against a local Supabase instance.
# It handles starting Supabase, running tests, and cleanup.
#
# Usage:
#   ./scripts/test-integration.sh           # Run all RLS tests
#   ./scripts/test-integration.sh --skip-start  # Skip supabase start (already running)
#   ./scripts/test-integration.sh --no-cleanup  # Skip cleanup after tests
#
# Prerequisites:
#   - Supabase CLI installed (npm install -g supabase or brew install supabase/tap/supabase)
#   - Docker running (required by Supabase local)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SUPABASE_DIR="$PROJECT_ROOT/supabase"
TESTS_DIR="$SUPABASE_DIR/tests"

# Default options
SKIP_START=false
NO_CLEANUP=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-start)
            SKIP_START=true
            shift
            ;;
        --no-cleanup)
            NO_CLEANUP=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-start    Skip 'supabase start' (assume already running)"
            echo "  --no-cleanup    Skip cleanup after tests"
            echo "  --verbose, -v   Show verbose output"
            echo "  --help, -h      Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check for Supabase CLI
    if ! command -v supabase &> /dev/null; then
        log_error "Supabase CLI is not installed."
        echo "Install with: npm install -g supabase"
        echo "Or: brew install supabase/tap/supabase"
        exit 1
    fi

    # Check for Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed."
        exit 1
    fi

    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi

    # Check for test files
    if [ ! -d "$TESTS_DIR" ]; then
        log_error "Tests directory not found: $TESTS_DIR"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Start Supabase
start_supabase() {
    if [ "$SKIP_START" = true ]; then
        log_info "Skipping supabase start (--skip-start flag)"
        return 0
    fi

    log_info "Starting Supabase local development environment..."
    cd "$PROJECT_ROOT"

    # Check if already running
    if supabase status &> /dev/null; then
        log_info "Supabase is already running"
        return 0
    fi

    # Start Supabase
    supabase start

    # Wait for services to be ready
    log_info "Waiting for Supabase services to be ready..."
    sleep 5

    log_success "Supabase started successfully"
}

# Get database connection string
get_db_url() {
    local db_url
    db_url=$(supabase status --output json 2>/dev/null | grep -o '"DB_URL":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$db_url" ]; then
        # Fallback to default local Supabase URL
        db_url="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    fi

    echo "$db_url"
}

# Run a single test file
run_test_file() {
    local test_file="$1"
    local test_name=$(basename "$test_file" .test.sql)
    local db_url=$(get_db_url)

    log_info "Running test: $test_name"

    # Run the test SQL file
    if $VERBOSE; then
        psql "$db_url" -f "$test_file" 2>&1
    else
        output=$(psql "$db_url" -f "$test_file" 2>&1)
        exit_code=$?

        if [ $exit_code -ne 0 ]; then
            log_error "Test failed: $test_name"
            echo "$output"
            return 1
        fi

        # Count PASSED and FAILED in output
        passed=$(echo "$output" | grep -c "TEST PASSED" || true)
        failed=$(echo "$output" | grep -c "TEST FAILED" || true)

        if [ "$failed" -gt 0 ]; then
            log_error "Test failed: $test_name ($passed passed, $failed failed)"
            echo "$output" | grep -E "(TEST PASSED|TEST FAILED|EXCEPTION)"
            return 1
        else
            log_success "Test passed: $test_name ($passed tests)"
        fi
    fi

    return 0
}

# Run all tests
run_all_tests() {
    log_info "Running RLS integration tests..."
    echo ""

    local total_files=0
    local passed_files=0
    local failed_files=0
    local failed_tests=()

    # Find and run all test files
    for test_file in "$TESTS_DIR"/*.test.sql; do
        if [ -f "$test_file" ]; then
            total_files=$((total_files + 1))

            if run_test_file "$test_file"; then
                passed_files=$((passed_files + 1))
            else
                failed_files=$((failed_files + 1))
                failed_tests+=("$(basename "$test_file")")
            fi
            echo ""
        fi
    done

    # Summary
    echo "=============================================="
    echo -e "${BLUE}TEST SUMMARY${NC}"
    echo "=============================================="
    echo "Total test files: $total_files"
    echo -e "Passed: ${GREEN}$passed_files${NC}"
    echo -e "Failed: ${RED}$failed_files${NC}"

    if [ $failed_files -gt 0 ]; then
        echo ""
        echo "Failed tests:"
        for test in "${failed_tests[@]}"; do
            echo "  - $test"
        done
        return 1
    fi

    return 0
}

# Cleanup
cleanup() {
    if [ "$NO_CLEANUP" = true ]; then
        log_info "Skipping cleanup (--no-cleanup flag)"
        return 0
    fi

    log_info "Cleaning up test data..."

    local db_url=$(get_db_url)

    # Run cleanup SQL
    psql "$db_url" -c "
        DO \$\$
        DECLARE
            test_user_ids uuid[] := ARRAY[
                '11111111-1111-1111-1111-111111111111'::uuid,
                '22222222-2222-2222-2222-222222222222'::uuid
            ];
        BEGIN
            SET LOCAL ROLE postgres;
            DELETE FROM public.monthly_goals WHERE user_id = ANY(test_user_ids);
            DELETE FROM public.time_entries WHERE user_id = ANY(test_user_ids);
            DELETE FROM public.active_timers WHERE user_id = ANY(test_user_ids);
            DELETE FROM public.categories WHERE user_id = ANY(test_user_ids);
            DELETE FROM public.users WHERE id = ANY(test_user_ids);
            DELETE FROM auth.users WHERE id = ANY(test_user_ids);
            RESET ROLE;
        END \$\$;
    " &> /dev/null || true

    log_success "Cleanup complete"
}

# Stop Supabase
stop_supabase() {
    if [ "$SKIP_START" = true ]; then
        return 0
    fi

    log_info "Stopping Supabase..."
    cd "$PROJECT_ROOT"
    supabase stop &> /dev/null || true
    log_success "Supabase stopped"
}

# Main execution
main() {
    echo ""
    echo "=============================================="
    echo -e "${BLUE}WorkTracker Integration Test Runner${NC}"
    echo "=============================================="
    echo ""

    # Check prerequisites
    check_prerequisites

    # Start Supabase
    start_supabase

    # Run tests
    local test_result=0
    if run_all_tests; then
        echo ""
        log_success "All tests passed!"
    else
        echo ""
        log_error "Some tests failed"
        test_result=1
    fi

    # Cleanup
    cleanup

    # Don't stop Supabase by default (user might want to inspect)
    # stop_supabase

    exit $test_result
}

# Handle Ctrl+C
trap 'echo ""; log_warn "Interrupted"; cleanup; exit 130' INT

# Run main
main
