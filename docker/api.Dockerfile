FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY apps/backend/package*.json ./

RUN npm ci --omit=dev

COPY apps/backend ./

EXPOSE 8000

CMD ["node", "src/server.js"]