# -----------------------------------
# STAGE 1: BUILDER
# -----------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Prisma Schema generate karo
RUN npx prisma generate

COPY . .

# TypeScript ko compile karo
RUN npm run build

# -----------------------------------
# STAGE 2: RUNNER (Production)
# -----------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Sirf zaroori modules aur compiled JS files (dist) copy karo
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/server.js"]