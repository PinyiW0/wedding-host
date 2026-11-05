# syntax=docker/dockerfile:1.6

# Node 版本單一來源：ARG 預設值與 .nvmrc、package.json engines 對齊，CI 直接讀 .nvmrc。
# 釘確切版而非浮動標籤（26-alpine）：浮動標籤建出什麼版本看建置當天，釘死才保證帶著已知的安全修補上線。
# Node 再出修補時改三處：.nvmrc、這裡的預設值、package.json engines（test/unit/node-version-sync.spec.ts 會比對）；臨時覆寫：docker build --build-arg NODE_VERSION=<版本>
ARG NODE_VERSION=26.13.0

# ---- Builder ----
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

# 先複製 lockfile 與 package.json 以利用 cache layer
COPY package.json package-lock.json .npmrc* ./

# 跳過 postinstall：容器無 .git 會讓 husky 失敗；nuxt prepare 於下一步手動執行
RUN npm ci --ignore-scripts

# 暫時補 reka-ui 2.11.0 toast 播報被 aria-hidden 的 bug（unovue/reka-ui#3049）；
# --ignore-scripts 讓 postinstall 不會跑，這裡手動套用。reka-ui 發布包含 #3050 的版本後移除 patches/ 與這一步
COPY patches ./patches
# --error-on-fail：沒有 CI 環境變數時 patch-package 套用失敗只會警告，加了才會讓建置中止
RUN npx patch-package --error-on-fail

# .dockerignore 會排除 .env 等機敏檔案
COPY . .

RUN npx nuxt prepare && npm run build

# ---- Runtime ----
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/.output ./.output
USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
