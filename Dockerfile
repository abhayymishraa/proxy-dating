FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production DB_PATH=/data/cupid.db
EXPOSE 3000
CMD ["npm", "start"]
