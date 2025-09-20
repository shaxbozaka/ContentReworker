#!/bin/bash

# Content Reworker Deployment Script
# This script builds and deploys the application to your server

set -e

echo "🚀 Starting Content Reworker deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required files exist
if [ ! -f ".env.production" ]; then
    print_error ".env.production file not found! Please create it with your production environment variables."
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

print_status "Installing dependencies..."
npm ci

print_status "Running type checks..."
npm run check

print_status "Building the application..."
npm run build

print_status "Running database migrations..."
npm run db:push

print_status "Application built successfully!"
print_warning "Next steps:"
echo "1. Copy the built application to your server"
echo "2. Set up your production environment variables"
echo "3. Start the application with 'npm start' or use PM2/systemd"
echo "4. Configure reverse proxy (nginx) if needed"

echo -e "${GREEN}✅ Deployment preparation complete!${NC}"