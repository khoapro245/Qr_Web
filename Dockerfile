# QR Care production image: the API and the built web app in one Node.js process.
# Build:  docker build -t qrcare .
# Run:    see deploy/compose.yml and docs/deployment.md

# ---- Build: install everything, compile shared, backend and frontend ----------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Dependency manifests first so this layer is cached until they change.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

COPY tsconfig.base.json ./
COPY shared shared
COPY backend backend
COPY frontend frontend
RUN npm run build

# ---- Runtime: production dependencies and compiled output only ---------------------------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    FRONTEND_DIST_DIR=/app/frontend/dist \
    STORAGE_LOCAL_DIR=/data/storage

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# Only the API's runtime dependencies (no dev tools, no frontend libraries: it is prebuilt).
RUN npm ci --omit=dev --workspace backend --workspace shared --include-workspace-root=false \
    && npm cache clean --force

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/migrations backend/migrations
COPY --from=build /app/frontend/dist frontend/dist

# Uploaded avatars live on a volume mounted here; the app runs as the unprivileged "node" user.
RUN mkdir -p /data/storage && chown -R node:node /data
VOLUME ["/data/storage"]
USER node
WORKDIR /app/backend

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/scripts/start-production.js"]
