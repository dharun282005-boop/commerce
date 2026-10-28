# Web app image: production Next.js build.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts -w @cuc/web --include-workspace-root=false
COPY apps/web ./apps/web
ARG NEXT_PUBLIC_API_URL=http://localhost:4100
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @cuc/web

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web ./apps/web
USER node
EXPOSE 3100
WORKDIR /app/apps/web
CMD ["npx", "next", "start", "--port", "3100"]
