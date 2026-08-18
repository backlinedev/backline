FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY fixtures ./fixtures

RUN npm run build

# Keep container running (not a typical server)
CMD ["tail", "-f", "/dev/null"]
