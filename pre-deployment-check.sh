#!/bin/bash
# Production Deployment Checklist
# Run this script 48 hours before production deployment

set -e

echo "🚀 WA Intelligence Platform - Pre-Deployment Verification"
echo "================================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "1️⃣  CODE QUALITY CHECKS"
echo "================================================================"

# TypeScript compilation
if cd backend && npm run build > /dev/null 2>&1; then
    check_pass "Backend TypeScript compilation successful"
    cd ..
else
    check_fail "Backend TypeScript compilation failed"
    cd ..
fi

if cd frontend && npm run build > /dev/null 2>&1; then
    check_pass "Frontend build successful"
    cd ..
else
    check_fail "Frontend build failed"
    cd ..
fi

# Check for console.log in production code
if ! grep -r "console\\.log" backend/src --include="*.ts" | grep -v "test\|spec" > /dev/null 2>&1; then
    check_pass "No console.log statements in production code"
else
    check_fail "Found console.log statements in production code"
fi

# Check for hardcoded secrets
if ! grep -r "password.*=.*['\"][a-zA-Z0-9]*['\"]" backend/src --include="*.ts" > /dev/null 2>&1; then
    check_pass "No hardcoded credentials found"
else
    check_warn "Review hardcoded values manually"
fi

echo ""
echo "2️⃣  SECURITY CHECKS"
echo "================================================================"

# Environment variables
if [ -f backend/.env.production ]; then
    check_pass "Production environment file exists"
    
    # Check required secrets
    if grep -q "ENCRYPTION_KEY=" backend/.env.production && \
       grep -q "JWT_SECRET=" backend/.env.production && \
       grep -q "SUPABASE_URL=" backend/.env.production; then
        check_pass "Required environment variables present"
    else
        check_fail "Missing required environment variables"
    fi
else
    check_fail "Production environment file not found"
fi

# Check JWT secret strength (at least 32 chars)
if grep "JWT_SECRET=" backend/.env.production 2>/dev/null | grep -E "JWT_SECRET=[a-zA-Z0-9]{32,}" > /dev/null; then
    check_pass "JWT secret appears strong (32+ chars)"
else
    check_warn "JWT secret may be too weak (should be 32+ chars)"
fi

# Check ENCRYPTION_KEY (should be 64 hex chars)
if grep "ENCRYPTION_KEY=" backend/.env.production 2>/dev/null | grep -E "ENCRYPTION_KEY=[a-fA-F0-9]{64}" > /dev/null; then
    check_pass "ENCRYPTION_KEY is 256-bit (64 hex chars)"
else
    check_fail "ENCRYPTION_KEY is not valid 256-bit key"
fi

# CORS configuration
if grep "CORS_ORIGINS=" backend/.env.production 2>/dev/null | grep -E "CORS_ORIGINS=https://" > /dev/null; then
    check_pass "CORS configured for production domain"
else
    check_warn "Verify CORS_ORIGINS is set to production domain"
fi

# TLS enforcement
if grep "FRONTEND_URL=" backend/.env.production 2>/dev/null | grep -E "FRONTEND_URL=https://" > /dev/null; then
    check_pass "Frontend URL uses HTTPS"
else
    check_fail "Frontend URL should use HTTPS"
fi

echo ""
echo "3️⃣  DATABASE CHECKS"
echo "================================================================"

# Check Supabase connection
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_KEY" ]; then
    check_pass "Supabase credentials set"
else
    check_warn "Supabase credentials not in current shell (may be in .env)"
fi

# Verify migration files exist
if ls backend/../supabase/migrations/*.sql > /dev/null 2>&1; then
    count=$(ls backend/../supabase/migrations/*.sql | wc -l)
    check_pass "Found $count database migration files"
else
    check_fail "Migration files not found"
fi

echo ""
echo "4️⃣  INFRASTRUCTURE CHECKS"
echo "================================================================"

# Docker availability
if command -v docker &> /dev/null; then
    check_pass "Docker is installed"
else
    check_fail "Docker not found (needed for deployment)"
fi

# Docker compose
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    check_pass "Docker Compose available"
else
    check_fail "Docker Compose not found"
fi

# Check docker-compose.yml for production
if grep "redis:" docker-compose.yml > /dev/null 2>&1; then
    check_pass "Redis service configured in Docker Compose"
else
    check_warn "Verify Redis configuration for production"
fi

echo ""
echo "5️⃣  MONITORING & LOGGING"
echo "================================================================"

# Sentry configuration
if grep -r "SENTRY_DSN" backend/.env.production 2>/dev/null; then
    check_pass "Sentry error tracking configured"
else
    check_warn "Consider adding Sentry for production error tracking"
fi

# Logging level
if grep "LOG_LEVEL=error\|LOG_LEVEL=warn" backend/.env.production 2>/dev/null > /dev/null; then
    check_pass "Logging level set appropriately for production"
else
    check_warn "Verify LOG_LEVEL is set to 'error' or 'warn' for production"
fi

echo ""
echo "6️⃣  VERSION & RELEASE"
echo "================================================================"

# Get current version
if [ -f backend/package.json ]; then
    VERSION=$(grep '"version"' backend/package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
    check_pass "Backend version: $VERSION"
fi

# Check git status
if command -v git &> /dev/null; then
    if [ -z "$(git status --porcelain)" ]; then
        check_pass "Git working directory clean"
    else
        check_warn "Git working directory has uncommitted changes"
    fi
fi

echo ""
echo "7️⃣  NODE.js & DEPENDENCIES"
echo "================================================================"

# Node version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    if [[ $NODE_VERSION == v2[0-9]* ]]; then
        check_pass "Node.js version: $NODE_VERSION (22+ required)"
    else
        check_warn "Node.js version is $NODE_VERSION (22+ recommended)"
    fi
else
    check_fail "Node.js not installed"
fi

# Check package-lock.json
if [ -f backend/package-lock.json ] && [ -f frontend/package-lock.json ]; then
    check_pass "package-lock.json files present (locked dependencies)"
else
    check_warn "Consider using npm ci instead of npm install for reproducible builds"
fi

echo ""
echo "8️⃣  DEPLOYMENT ARTIFACTS"
echo "================================================================"

# Check backend dist
if [ -d "backend/dist" ]; then
    check_pass "Backend compiled successfully (dist/ exists)"
else
    check_fail "Backend dist/ folder not found (run npm run build)"
fi

# Check frontend .next
if [ -d "frontend/.next" ]; then
    check_pass "Frontend built successfully (.next/ exists)"
else
    check_fail "Frontend .next/ folder not found (run npm run build)"
fi

echo ""
echo "9️⃣  DEPLOYMENT READINESS"
echo "================================================================"

# Create deployment summary
READY=true

if [ $FAIL -gt 0 ]; then
    READY=false
fi

echo ""
echo "==================================================================="
echo "DEPLOYMENT READINESS SUMMARY"
echo "==================================================================="
echo "Passed checks: $PASS"
echo "Failed checks: $FAIL"
echo ""

if [ "$READY" = true ]; then
    echo -e "${GREEN}✓ READY FOR DEPLOYMENT${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review PHASE_9_PERFORMANCE_DEPLOYMENT.md for load testing procedures"
    echo "2. Execute load tests (k6 load-test-k6.js)"
    echo "3. Run database migrations on production"
    echo "4. Deploy backend to Railway/Fly.io"
    echo "5. Deploy frontend to Vercel"
    echo "6. Monitor error tracking (Sentry) and logs"
    echo "7. Run smoke tests (login, dashboard, send message)"
    echo ""
    exit 0
else
    echo -e "${RED}✗ NOT READY FOR DEPLOYMENT${NC}"
    echo ""
    echo "Please fix the failed checks above before proceeding."
    echo ""
    exit 1
fi
