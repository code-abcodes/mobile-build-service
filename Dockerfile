FROM docker:27-dind

RUN apk add --no-cache nodejs npm git

WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.js ./

EXPOSE 3001
CMD ["node", "server.js"]