# Backend Dockerfile
FROM node:18-alpine AS builder

# Install build dependencies for canvas and other native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR /app

# Copy package files (use isolated Docker package.json)
COPY package.docker.json ./package.json
COPY prisma ./prisma/

# Create a completely isolated npm environment
RUN rm -rf ~/.npm && \
    npm config set fund false && \
    npm config set audit false && \
    npm config set package-lock false && \
    npm config set workspaces false && \
    npm config set workspace false && \
    npm install --no-workspaces --legacy-peer-deps --verbose && \
    npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies for canvas and dumb-init
RUN apk add --no-cache \
    dumb-init \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files first for production dependencies
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Install only production dependencies with completely isolated npm environment
RUN rm -rf ~/.npm && \
    npm config set fund false && \
    npm config set audit false && \
    npm config set package-lock false && \
    npm config set workspaces false && \
    npm config set workspace false && \
    npm install --omit=dev --no-workspaces --legacy-peer-deps --verbose && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]