# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

# Copy frontend package files and install
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy full source
COPY tsconfig*.json ./
COPY src ./src
COPY frontend ./frontend

# Build frontend and backend
RUN cd frontend && npm run build
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/frontend/dist ./frontend/dist

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
