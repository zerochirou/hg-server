FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm@9.0.0 turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune app --docker

FROM base AS installer
WORKDIR /app

# First install dependencies
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Copy source code and build
COPY --from=builder /app/out/full/ .

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter app build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=installer --chown=nextjs:nodejs /app/apps/app/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/app/.next/static ./apps/app/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/app/public ./apps/app/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/app/server.js"]
