FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
ARG BUILD_VERSION=0.1.0
ARG BUILD_ARCH=amd64
WORKDIR /app
ENV NODE_ENV=production
ENV BUILD_VERSION="${BUILD_VERSION}"
LABEL \
  io.hass.version="${BUILD_VERSION}" \
  io.hass.type="app" \
  io.hass.arch="${BUILD_ARCH}" \
  org.opencontainers.image.title="Immich HA Smart Frame Controller" \
  org.opencontainers.image.description="Home Assistant controlled Lenovo Smart Frame controller for Immich and immich-kiosk" \
  org.opencontainers.image.source="https://github.com/hyungyunlim/immich-ha-sa"
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/index.js"]
