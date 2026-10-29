# Multi-stage Dockerfile for DFMSPH22 PWA (Render / any container host)
# The C engine ships precompiled as engine/dfmsph22.wasm, so no C compiler is needed.
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .

# Build Vite frontend and bundled Express server (dist/server.cjs)
RUN npm run build

FROM node:20-slim AS runner

WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/engine ./engine
COPY --from=builder /app/*.c /app/*.h ./

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]
