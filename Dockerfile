# syntax=docker/dockerfile:1.6
# Node 22 (LTS) on Alpine. Node 18 reached end-of-life 2025-04-30.
FROM node:22-alpine

RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy package files first so the install layer caches as long as
# package.json + package-lock.json are unchanged.
COPY package*.json ./

# BuildKit cache mount: npm's tarball cache survives across rebuilds.
# Combined with the layer cache above, source-only rebuilds take <30s
# instead of ~2 min.
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund

COPY . .

RUN npm run build

# Non-root runtime user.
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001 \
 && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --quiet --spider http://0.0.0.0:5000/ || exit 1

CMD ["npm", "start"]
