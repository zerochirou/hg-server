#!/bin/sh
set -e

echo "Applying database migrations..."
pnpm db:migrate:deploy || npx prisma migrate deploy

echo "Starting NestJS server..."
exec node dist/main.js
