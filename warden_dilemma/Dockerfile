# Warden's Dilemma - Production Dockerfile
# Multi-stage build for optimal image size

# Stage 1: Build client
FROM node:18-alpine AS client-builder

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy client source
COPY client ./client

# Build client
RUN pnpm --filter warden-dilemma-client build

# Stage 2: Build server
FROM node:18-alpine AS server-builder

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY server/package.json ./server/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy server source
COPY server ./server

# Build server
RUN pnpm --filter warden-dilemma-server build

# Stage 3: Production image
FROM node:18-alpine AS production

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY server/package.json ./server/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built server from server-builder stage
COPY --from=server-builder /app/server/dist ./server/dist

# Copy built client from client-builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port (Cloud Run will inject PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server/dist/index.js"]
