#!/bin/bash

# Database Migration Script for Production
# This script sets up the database schema for the Content Reworker application

set -e

echo "🗄️  Setting up database for Content Reworker..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL environment variable is not set!"
    print_warning "Please set DATABASE_URL in your .env.production file or environment"
    exit 1
fi

print_status "Checking database connection..."

# Test database connection
if ! command -v psql &> /dev/null; then
    print_warning "psql command not found. Installing PostgreSQL client might be needed."
fi

print_status "Running Drizzle migrations..."
npm run db:push

print_status "Database setup complete!"
print_warning "Make sure your database has the following:"
echo "  - Users can be created and authenticated"
echo "  - Content transformations can be stored"
echo "  - Social connections (if using LinkedIn integration) can be saved"

echo -e "${GREEN}✅ Database migration complete!${NC}"