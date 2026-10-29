# AttendTrack Production Dockerfile
FROM node:20-slim AS builder

WORKDIR /app

# Install system dependencies needed for native modules (e.g. canvas/tesseract if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definitions
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd server && npm install
RUN cd client && npm install

# Copy source code
COPY . .

# Generate Prisma client and build client assets
RUN npx prisma generate --schema=server/prisma/schema.prisma
RUN cd client && npm run build

# Production Runtime
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => { if (r.statusCode !== 200) process.exit(1); })"

CMD ["node", "server/src/index.js"]
