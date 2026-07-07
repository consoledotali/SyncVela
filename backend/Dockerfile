FROM node:20-alpine

WORKDIR /app

# Sirf package files copy karo taake cache faida de
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Prisma schema ko generate karo
RUN npx prisma generate

# Ab baqi code copy karo (.dockerignore kachra rok lega)
COPY . .

# TypeScript ko JavaScript (dist folder) mein compile karo
# WARNING: Ensure karo ke backend/package.json mein "build": "tsc" script mojood ho!
RUN npm run build

EXPOSE 5000

# Production mein strictly compiled JS chalti hai, ts-node nahi
CMD ["node", "dist/server.js"]