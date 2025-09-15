# Backend Dockerfile
FROM node:18-alpine AS builder

# Install build dependencies for canvas and other native modules
RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    pkgconfig \
    cairo-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    && ln -sf python3 /usr/bin/python \
    && npm config set python python3 \
    && npm config set registry https://registry.npmjs.org/ \
    && npm config set timeout 300000 \
    && npm config set maxsockets 1

# Set working directory
WORKDIR /app

# Copy package files (use isolated Docker package.json)
COPY package.docker.json ./package.json
COPY prisma ./prisma/

# Create a completely isolated npm environment with better error handling
RUN rm -rf ~/.npm /tmp/* && \
    npm config set fund false && \
    npm config set audit false && \
    npm config set package-lock false && \
    npm config set workspaces false && \
    npm config set workspace false && \
    npm config set maxsockets 1 && \
    npm config set registry https://registry.npmjs.org/ && \
    npm install --no-workspaces --legacy-peer-deps --no-optional --production=false --verbose --timeout=300000 && \
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
    python3 \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    vips && \
    ln -sf python3 /usr/bin/python

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files and built node_modules from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Generate Prisma client for production
RUN npx prisma generate

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