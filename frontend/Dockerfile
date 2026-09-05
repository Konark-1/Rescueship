# ─────────────────────────────────────────────
# RescueShip Frontend — Production Image
# Stage 1: build the Vite bundle
# Stage 2: serve via nginx (same-origin /api + /webhooks proxy)
# ─────────────────────────────────────────────

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# VITE_API_URL intentionally unset → app calls are same-origin; nginx proxies to the API.
RUN npm run build

# ─── Runtime ───
FROM nginx:1.27-alpine AS runner

# Non-root port inside the container (host maps 80→8080, 443→8443 via compose)
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN nginx -t

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
