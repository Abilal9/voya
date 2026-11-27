# Voya API production image. Build from the REPOSITORY ROOT (workspace):
#   docker build -f apps/api/Dockerfile -t voya-api .
# Railway uses this via apps/api/railway.json. No secrets are baked in: all
# configuration arrives as environment variables at runtime.

FROM node:20.19-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --filter @voya/api... --ignore-scripts
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @voya/api build \
  && pnpm --filter @voya/api --prod deploy /out \
  && cp -r apps/api/dist apps/api/prisma /out/ \
  && cd /out && ./node_modules/.bin/prisma generate

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
# Migrations run as Railway's pre-deploy step (`prisma migrate deploy`), not here.
CMD ["node", "dist/main.js"]
