FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace=packages/shared --workspace=apps/web --include-workspace-root
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npm run build --workspace=packages/shared && npm run build --workspace=apps/web

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
