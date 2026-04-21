# Build stage
FROM oven/bun:debian AS builder

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock* .npmrc ./

# Install dependencies with GitHub Packages auth using Docker secret
RUN --mount=type=secret,id=gh_token \
    export GITHUB_TOKEN=$(cat /run/secrets/gh_token) && \
    bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM nginx:alpine AS production

# Install curl for health checks and create non-root user in one layer
RUN apk add --no-cache curl && \
    adduser -D -H -s /sbin/nologin nginx-user && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /run/nginx.pid && \
    chown nginx-user:nginx-user /run/nginx.pid

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application and static assets with correct ownership in a single layer each
COPY --chown=nginx-user:nginx-user --from=builder /app/dist /usr/share/nginx/html
COPY --chown=nginx-user:nginx-user ./data /usr/share/nginx/html/data
COPY --chown=nginx-user:nginx-user ./models /usr/share/nginx/html/models
COPY --chown=nginx-user:nginx-user ./img /usr/share/nginx/html/img

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Switch to non-root user
USER nginx-user

# Start nginx
CMD ["nginx", "-g", "daemon off;"]