FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .

FROM base AS web
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS worker
CMD ["npm", "run", "worker"]

FROM base AS session
CMD ["npm", "run", "session"]
