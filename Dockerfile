# syntax=docker/dockerfile:1

# ---- dependencies stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

# Environment
ENV NODE_ENV=production \
    PORT=5000

# Copy production node_modules only
COPY --from=deps /app/node_modules ./node_modules

# Copy app source (keep image small by relying on .dockerignore if present)
COPY . .

# Prepare uploads directory and drop privileges
RUN mkdir -p uploads && addgroup -S nodejs && adduser -S node -G nodejs && chown -R node:node /app
USER node

EXPOSE 5000

CMD ["node", "index.js"]


