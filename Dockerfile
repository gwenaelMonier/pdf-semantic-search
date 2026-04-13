# syntax=docker/dockerfile:1

# ─── Stage 1: production dependencies only ────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
# Install ALL deps (devDependencies needed by next build / TypeScript)
COPY package.json package-lock.json ./
RUN npm ci
# Copy source (.dockerignore excludes node_modules, .next, .env*)
COPY . .
# Produces .next/standalone/
RUN npm run build

# ─── Stage 3: minimal runtime image ───────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone server (no node_modules needed)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Static assets (JS chunks, CSS, fonts) — not included in standalone by default
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Public folder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Preset PDFs — read at runtime via process.cwd()/collective-agreement/
# process.cwd() = /app (WORKDIR), so these land at /app/collective-agreement/
COPY --from=builder --chown=nextjs:nodejs /app/collective-agreement ./collective-agreement

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
