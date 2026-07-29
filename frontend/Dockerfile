FROM node:24-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.8.0 --activate
WORKDIR /app

COPY frontend/package.json frontend/pnpm-workspace.yaml frontend/pnpm-lock.yaml frontend/tsconfig.base.json ./
COPY frontend/applications/web/package.json applications/web/package.json
COPY frontend/packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

FROM node:24-alpine

WORKDIR /app
COPY --from=build --chown=node:node /app/applications/web/.output ./.output

ENV HOST=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=production

EXPOSE 3000
USER node
CMD ["node", ".output/server/index.mjs"]
