FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S healthcheck && \
    adduser -S healthcheck -u 1001

# Change ownership
RUN chown -R healthcheck:healthcheck /app
USER healthcheck

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node healthcheck.js --self-check

EXPOSE 8080

CMD ["node", "server.js"]