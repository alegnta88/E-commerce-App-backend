FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000

COPY --from=deps /app/node_modules ./node_modules

COPY . .

COPY .env .

RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 5000

CMD ["node", "index.js"]