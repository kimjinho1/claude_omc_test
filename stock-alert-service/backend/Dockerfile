FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
# Compile seed.ts to CJS (ts-node not available in production image)
# rootDir inferred as prisma/, so output is dist/seed/seed.js
RUN npx tsc --module commonjs --moduleResolution node --target ES2020 \
    --esModuleInterop true --resolveJsonModule true \
    --outDir dist/seed --skipLibCheck true \
    prisma/seed.ts
# Copy JSON seed data next to the compiled seed.js
RUN cp -r prisma/seed dist/seed/seed

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
