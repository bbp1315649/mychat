FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all project source files
COPY . .

# Build Vite frontend and Express server bundle
RUN npm run build

# Expose standard port 3000
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start server
CMD ["node", "dist/server.cjs"]
