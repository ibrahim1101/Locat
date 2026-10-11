ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM ${NODE_IMAGE}
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/db ./db
USER node
EXPOSE 3000
CMD ["sh", "-c", "node scripts/setup-db.mjs && node dist/boot.js"]
