FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Legacy peer deps agar UI libraries tang karein
RUN npm install --legacy-peer-deps 

COPY . .

# Next.js ko production mode mein build karo
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]