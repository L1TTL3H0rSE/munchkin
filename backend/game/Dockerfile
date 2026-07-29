FROM golang:1.25.1-alpine AS build

WORKDIR /src/backend/game
COPY backend/game/go.mod backend/game/go.sum ./
RUN go mod download
COPY backend/game/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/game ./cmd/server

FROM alpine:3.23

RUN addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build --chown=app:app /out/game /app/game
COPY --chown=app:app backend/game/migrations /app/migrations
COPY --chown=app:app content /app/content

ENV SERVER_ADDR=:8080 \
    GAME_CONTENT_PATH=/app/content/sets/demo/cards.json \
    MIGRATION_PATH=/app/migrations/000001_game.up.sql \
    AUTO_MIGRATE=true

EXPOSE 8080
USER app
ENTRYPOINT ["/app/game"]
