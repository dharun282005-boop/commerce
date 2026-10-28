# API image. Runs TypeScript directly with tsx (see docs/DECISIONS.md).
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
USER node
ENV SEED_ON_START=true
EXPOSE 4100
CMD ["npm", "run", "start", "-w", "@cuc/api"]
