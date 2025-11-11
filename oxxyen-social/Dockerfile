# Multi-stage build for OXXYEN SOCIAL

# Stage 1: Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production

# Stage 2: Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
COPY frontend/ ./
RUN npm ci && npm run build

# Stage 3: Final image
FROM node:20-alpine
RUN apk add --no-cache mongodb-tools

# Install ngrok
RUN wget -qO- https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar xvz -C /usr/local/bin

WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/backend /app/backend
COPY backend/ /app/backend/

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Copy other files
COPY .env.example .env
COPY README.md ./

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3000 3001

# Start script
CMD ["sh", "backend/start.sh"]
