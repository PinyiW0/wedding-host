// 行程內滑動視窗限流（issue #70）：防登入爆破、公開端點濫用
// 注意：Vercel serverless 多實例、冷啟動會重置，僅單實例有效——
// 升級為 DB／KV 共享限流的路徑見 docs/security.md（殘餘風險 R3）
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// 消耗一次額度：回 true＝仍在限額內、false＝已超限（呼叫端回 429）
// 同 key 於 windowMs 視窗內累計，視窗到期自動重置
export function consumeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()

  // 避免長時間運行實例的 Map 無限膨脹：超過門檻時順手清掉過期 bucket
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt)
        buckets.delete(k)
    }
  }

  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  bucket.count++
  return bucket.count <= limit
}

// 清除某 key 的計數（如登入成功後呼叫，避免正常使用者被先前失敗次數拖累）
export function resetRateLimit(key: string): void {
  buckets.delete(key)
}
