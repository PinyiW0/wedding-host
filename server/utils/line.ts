// LINE Messaging API 發送層（M4 基礎建設）
// 未設定 NUXT_LINE_CHANNEL_ACCESS_TOKEN 時一律回傳失敗/null，呼叫端維持 mock 行為；
// 申請 LINE OA（輕用量 200 則/月）＋ Messaging API channel 後填入 token 即啟用真發送。
// 注意：輕用量額度不可加購；群發前 UI 顯示發送則數供使用者確認、後端另做剩餘額度預檢（issue #72）。

interface LineTextMessage {
  type: 'text'
  text: string
}

interface LineImageMessage {
  type: 'image'
  originalContentUrl: string
  previewImageUrl: string
}

export type LineMessage = LineTextMessage | LineImageMessage

// 真實 LINE userId 格式（U + 32 hex）；dev seed 的假 ID（line-u-*）不符，
// 混入 multicast 會讓整批被 LINE 以 400 退回，發送前一律過濾
export const LINE_USER_ID_RE = /^U[0-9a-f]{32}$/

// 單一使用者推播（謝卡單獨重發用）；成功回 true、失敗或未設定 token 回 false
export async function pushLineMessage(lineUserId: string, messages: LineMessage[]): Promise<boolean> {
  const token = useRuntimeConfig().lineChannelAccessToken
  if (!token)
    return false
  try {
    await $fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { to: lineUserId, messages },
    })
    return true
  }
  catch {
    return false
  }
}

// 是否已設定 LINE 真發送（呼叫端據此決定走真發送或 mock 行為）
export function isLinePushConfigured(): boolean {
  return !!useRuntimeConfig().lineChannelAccessToken
}

// 群發（multicast）：同一組訊息發給多位使用者，每批 ≤500 人、一次 API 呼叫。
// 成敗以批為單位計（LINE 對整批回 2xx/4xx）；非真實格式的 userId 先剔除計入失敗。
// failedUserIds 回傳未送達的 userId（無效格式＋失敗批次，已去重），供呼叫端對回賓客做重發
export async function multicastLineMessages(lineUserIds: string[], messages: LineMessage[]): Promise<{ successCount: number, failedCount: number, failedUserIds: string[] }> {
  const token = useRuntimeConfig().lineChannelAccessToken
  if (!token)
    return { successCount: 0, failedCount: lineUserIds.length, failedUserIds: [...new Set(lineUserIds)] }

  const invalidCount = lineUserIds.filter(id => !LINE_USER_ID_RE.test(id)).length
  // 去重：多位賓客可能綁同一個 LINE 帳號（家庭共用），重複 userId 會讓 multicast 整批被退
  const valid = [...new Set(lineUserIds.filter(id => LINE_USER_ID_RE.test(id)))]
  const failedUserIds = [...new Set(lineUserIds.filter(id => !LINE_USER_ID_RE.test(id)))]
  let successCount = 0
  let failedCount = invalidCount
  for (let i = 0; i < valid.length; i += 500) {
    const batch = valid.slice(i, i + 500)
    try {
      await $fetch('https://api.line.me/v2/bot/message/multicast', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { to: batch, messages },
      })
      successCount += batch.length
    }
    catch (error: any) {
      // 失敗原因進 server log（Vercel／Sentry 可查），呼叫端以人數＋失敗名單感知結果
      console.error('[line] multicast 失敗：', error?.data ?? error?.message ?? error)
      failedCount += batch.length
      failedUserIds.push(...batch)
    }
  }
  return { successCount, failedCount, failedUserIds }
}

// 當月剩餘推播額度：limited 方案回剩餘則數；無上限方案或查詢失敗回 null
// （null＝不預檢，交由 LINE 端把關——超量時該批發送會被拒，不會產生費用）
export async function getLineQuotaRemaining(): Promise<number | null> {
  const token = useRuntimeConfig().lineChannelAccessToken
  if (!token)
    return null
  try {
    const headers = { Authorization: `Bearer ${token}` }
    const quota = await $fetch<{ type: string, value?: number }>('https://api.line.me/v2/bot/message/quota', { headers })
    if (quota.type !== 'limited' || typeof quota.value !== 'number')
      return null
    const usage = await $fetch<{ totalUsage: number }>('https://api.line.me/v2/bot/message/quota/consumption', { headers })
    return Math.max(0, quota.value - usage.totalUsage)
  }
  catch {
    return null
  }
}
