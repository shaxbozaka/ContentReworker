# Use Node.js 18 Alpine as the base image
FROM node:18-alpine

# Install essential packages
RUN apk add --no-cache ca-certificates

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev deps for building)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Keep Vite for production (it's needed by the server in production mode)
# Don't remove dev dependencies since they're needed at runtime

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 5000

# Health check (using wget since curl is not in Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --quiet --spider http://0.0.0.0:5000/ || exit 1

# Start the application
CMD ["npm", "start"]