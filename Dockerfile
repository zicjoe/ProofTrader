FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY prisma.config.ts ./
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm install
RUN npm run build --workspace @prooftrader/shared && npm run build --workspace @prooftrader/api

EXPOSE 4010

CMD ["sh", "-c", "npm run db:push --workspace @prooftrader/api && node apps/api/dist/index.js"]