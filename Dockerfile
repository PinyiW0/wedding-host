# syntax=docker/dockerfile:1.6

# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app

# 先複製 lockfile 與 package.json 以利用 cache layer
COPY package.json package-lock.json .npmrc* ./

# 跳過 postinstall：容器無 .git 會讓 husky 失敗；nuxt prepare 於下一步手動執行
RUN npm ci --ignore-scripts

# .dockerignore 會排除 .env 等機敏檔案
COPY . .

RUN npx nuxt prepare && npm run build

# ---- Runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/.output ./.output
USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
