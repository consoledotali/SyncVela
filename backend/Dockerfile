# syntax=docker/dockerfile:1.7
FROM node:22.13.1-alpine3.21@sha256:e2b39f7b64281324929257d0f8004fb6cb4bf0fdfb9aa8cedb235a766aec31da AS builder
WORKDIR /workspace/backend

COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci

COPY backend .
RUN DATABASE_URL=postgresql://prisma:prisma@127.0.0.1:5432/prisma npx prisma generate && npm run build

FROM node:22.13.1-alpine3.21@sha256:e2b39f7b64281324929257d0f8004fb6cb4bf0fdfb9aa8cedb235a766aec31da AS runner
WORKDIR /workspace/backend

ENV NODE_ENV=production \
    PORT=5000

# Prisma CLI is an explicit production dependency so this immutable image can
# run `prisma migrate deploy` without downloading a floating version at deploy time.
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci --omit=dev && DATABASE_URL=postgresql://prisma:prisma@127.0.0.1:5432/prisma npx prisma generate && npm cache clean --force

COPY --from=builder --chown=node:node /workspace/backend/dist ./dist
COPY --chown=node:node backend/prisma ./prisma

USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]
