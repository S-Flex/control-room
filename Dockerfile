FROM nginx:alpine

RUN apk add --no-cache curl && \
    adduser -D -H -s /sbin/nologin nginx-user && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /run/nginx.pid && \
    chown nginx-user:nginx-user /run/nginx.pid

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --chown=nginx-user:nginx-user ./dist /usr/share/nginx/html
COPY --chown=nginx-user:nginx-user ./data /usr/share/nginx/html/data
COPY --chown=nginx-user:nginx-user ./models /usr/share/nginx/html/models
COPY --chown=nginx-user:nginx-user ./img /usr/share/nginx/html/img

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

USER nginx-user

CMD ["nginx", "-g", "daemon off;"]
