# ==============================================================================
# Dockerfile for Firebase Genkit School Agent
# ==============================================================================

FROM node:20-slim

WORKDIR /app

# Install dependencies needed for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the TypeScript project
RUN npm run build

# Expose ports
EXPOSE 8080 4000 4033

# Default command - run the web server
CMD ["npm", "run", "start:server"]

