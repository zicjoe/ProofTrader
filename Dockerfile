FROM node:22-bookworm-slim

RUN apt-get update -y \
 && apt-get install -y openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm install --include=dev
RUN npm run build --workspace @prooftrader/shared
RUN npm run build --workspace @prooftrader/api
RUN test -f /app/apps/api/dist/index.js

EXPOSE 4010

CMD ["sh", "-c", "npm run db:push --workspace @prooftrader/api && exec node /app/apps/api/dist/index.js"]