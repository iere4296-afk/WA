FROM node:22-bookworm-slim AS deps
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app/backend

COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package.json backend/package-lock.json ./
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src

RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app/backend

ENV NODE_ENV=production

COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/package-lock.json ./package-lock.json
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist

EXPOSE 8080

CMD ["npm", "run", "start"]
