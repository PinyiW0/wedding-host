// LINE Messaging API 發送層（M4 基礎建設）
// 未設定 NUXT_LINE_CHANNEL_ACCESS_TOKEN 時一律回傳失敗/null，呼叫端維持 mock 行為；
// 申請 LINE OA（輕用量 200 則/月）＋ Messaging API channel 後填入 token 即啟用真發送。
// 注意：輕用量額度不可加購，群發前應檢查已綁定人數（額度追蹤需 DB，列 M4 待辦）。

interface LineTextMessage {
  type: 'text'
  text: string
}

// 單一使用者推播（謝卡個人化連結用）；成功回 true、失敗或未設定 token 回 false
export async function pushLineMessage(lineUserId: string, text: string): Promise<boolean> {
  const token = useRuntimeConfig().lineChannelAccessToken
  if (!token)
    return false
  try {
    await $fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { to: lineUserId, messages: [{ type: 'text', text }] satisfies LineTextMessage[] },
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
