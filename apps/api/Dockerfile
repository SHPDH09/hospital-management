FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci --workspace=packages/shared --workspace=apps/api --include-workspace-root
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm run build --workspace=packages/shared && npm run build --workspace=apps/api
RUN cd apps/api && npx prisma generate

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci --workspace=packages/shared --workspace=apps/api --include-workspace-root --omit=dev
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
