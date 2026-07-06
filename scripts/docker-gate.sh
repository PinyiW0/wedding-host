#!/usr/bin/env sh
# Docker gate（issue #12，自 Nuxt4-template-SDD 搬移＋DB 適配）：
# 以 production build（既有 Dockerfile → .output）跑 gate spec，
# 與本機 dev server 完全隔離 —— 多 session 同時 push 也不互撞。
# 流程：build image → 起 ephemeral Postgres → host 端跑 migration
#       → run app container（NUXT_AUTH_MODE=open，e2e 的 reset 端點負責 seed）
#       → 等 ready → host 端 Playwright 以 E2E_BASE_URL 打進 container → 清理。
set -eu

# 名稱唯一性：worktree 目錄 slug（不同 worktree 必不同）+ PID（同 worktree 並發 push 也不撞）
# BuildKit layer cache 是 content-addressable、與 image tag 解耦 —— 結尾 rmi 掉暫時 tag
# 不會丟 cache，下次 build 依然快；並發 build 共用 cache 由 BuildKit 內部鎖保證安全。
slug=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-*//; s/-*$//')
[ -n "$slug" ] || slug=nuxt-app
image="e2e-gate-${slug}:pid$$"
container="e2e-gate-${slug}-$$"
db_container="e2e-gate-db-${slug}-$$"
network="e2e-gate-net-${slug}-$$"

# 成功／失敗／Ctrl-C 都收乾淨（--rm 會自刪 container，這裡是保險 + 移除暫時 image tag／network）
cleanup() {
  docker rm -f "$container" "$db_container" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  docker rmi "$image" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# 注意：CJK 全形字元緊接變數時，sh 可能把多位元組字元誤併入變數名，故一律用 ${} 定界
echo "🐳 [1/6] Build production image（${image}）…（首次較慢，之後吃 layer cache）"
docker build -t "$image" .

echo "🐳 [2/6] 起 ephemeral 測試 Postgres（${db_container}）…"
docker network create "$network" >/dev/null
docker run -d --rm --name "$db_container" --network "$network" \
  -e POSTGRES_USER=wedding -e POSTGRES_PASSWORD=wedding -e POSTGRES_DB=wedding \
  -p 127.0.0.1::5432 postgres:17-alpine >/dev/null

i=0
until docker exec "$db_container" pg_isready -U wedding -d wedding >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "❌ 測試 Postgres 30 秒內未 ready"
    exit 1
  fi
  sleep 1
done

echo "🐳 [3/6] 跑 migration（host 端 drizzle-kit → 映射 port）…"
# production 的 ensureDbReady 是 no-op（不 migrate 不 seed），故由 gate 腳本先建表；
# seed 則由 e2e spec beforeEach 打 /api/__test__/reset 完成（truncate + seed，open 模式可用）
db_port=$(docker port "$db_container" 5432/tcp | head -n1 | awk -F: '{print $NF}')
if [ -z "$db_port" ]; then
  echo "❌ 取不到測試 DB 對映 port"
  exit 1
fi
NUXT_DATABASE_URL="postgresql://wedding:wedding@127.0.0.1:${db_port}/wedding" npx drizzle-kit migrate

echo "🐳 [4/6] Run app container（ephemeral port，僅綁 127.0.0.1）…"
# NUXT_AUTH_MODE=open：production build 預設 enforced 會擋掉凍結 spec 的
# 裸 URL／無 token 直打與 reset 端點（middleware 404），gate 需 open 相容模式
docker run -d --rm --name "$container" --network "$network" \
  -e NUXT_AUTH_MODE=open \
  -e NUXT_DATABASE_URL="postgresql://wedding:wedding@${db_container}:5432/wedding" \
  -p 127.0.0.1::3000 "$image" >/dev/null

# 查 Docker 分配到的 host port（輸出形如 127.0.0.1:54321，可能含 IPv6 行，取第一行）
port=$(docker port "$container" 3000/tcp | head -n1 | awk -F: '{print $NF}')
if [ -z "$port" ]; then
  echo "❌ 取不到 container 對映 port"
  exit 1
fi
base_url="http://127.0.0.1:${port}"

echo "🐳 [5/6] 等待 server ready（${base_url}，最長 60 秒）…"
i=0
ready=0
while [ "$i" -lt 60 ]; do
  if curl -fs -o /dev/null "$base_url/" 2>/dev/null; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "❌ Server 60 秒內未 ready，container logs（最後 50 行）："
  docker logs --tail 50 "$container" || true
  exit 1
fi

echo "🐳 [6/6] Run gate spec → ${base_url}"
E2E_BASE_URL="$base_url" npx playwright test --config playwright.gate.config.ts
