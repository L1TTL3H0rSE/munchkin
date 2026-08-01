FROM node:24-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS build

RUN corepack enable && corepack prepare pnpm@10.8.0 --activate
WORKDIR /app

COPY frontend/package.json frontend/pnpm-workspace.yaml frontend/pnpm-lock.yaml frontend/tsconfig.base.json ./
COPY frontend/applications/web/package.json applications/web/package.json
COPY frontend/packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

FROM node:24-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3

ARG OCI_SOURCE="https://github.com/L1TTL3H0rSE/munchkin"
ARG OCI_REVISION="unknown"
ARG OCI_CREATED="1970-01-01T00:00:00Z"
ARG OCI_LICENSES="MIT"

WORKDIR /app

LABEL org.opencontainers.image.source="${OCI_SOURCE}" \
      org.opencontainers.image.revision="${OCI_REVISION}" \
      org.opencontainers.image.created="${OCI_CREATED}" \
      org.opencontainers.image.licenses="${OCI_LICENSES}"

COPY --from=build --chown=node:node /app/applications/web/.output ./.output

ENV HOST=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=production

EXPOSE 3000
USER node
CMD ["node", ".output/server/index.mjs"]
