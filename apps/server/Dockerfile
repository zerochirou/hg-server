FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN npm install -g pnpm@9.0.0 turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune server --docker

FROM base AS installer
WORKDIR /app

# First install dependencies
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Copy source code and build
COPY --from=builder /app/out/full/ .
WORKDIR /app/apps/server
RUN pnpm db:generate
RUN pnpm build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
RUN npm install -g pnpm@9.0.0

COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/package.json ./package.json
COPY --from=installer /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=installer /app/apps/server ./apps/server

WORKDIR /app/apps/server
RUN chmod +x ./entrypoint.sh

EXPOSE 4000
ENV PORT=4000

CMD ["./entrypoint.sh"]
