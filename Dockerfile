FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
EXPOSE 3000 8081
CMD ["node", "server.js"]
