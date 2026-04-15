FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install csv-parser

COPY src ./src

EXPOSE 4000

CMD ["npm", "start"]
