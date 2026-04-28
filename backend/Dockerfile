FROM node:20-alpine

WORKDIR /app

# Only copy package files first (layer caching)
COPY package*.json ./

# Install dependencies — no cache dir conflict
RUN npm install --omit=dev --cache /tmp/.npm

# Copy source code (NOT node_modules — see .dockerignore)
COPY . .

EXPOSE 5001

CMD ["node", "src/server.js"]
