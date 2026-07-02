import type { MaybeRefOrGetter } from 'vue'

// 投影即時推送（mock）：審核頁 approve / project → 投影頁即時更新
// 機制：BroadcastChannel（同瀏覽器跨分頁）+ 短輪詢 fallback；正式 M0 改 WebSocket/SSE
export function useProjectionChannel(weddingId: MaybeRefOrGetter<string>) {
  let channel: BroadcastChannel | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    if (typeof BroadcastChannel !== 'undefined')
      channel = new BroadcastChannel(`projection-${toValue(weddingId)}`)
  })

  onBeforeUnmount(() => {
    channel?.close()
    channel = null
    if (timer)
      clearInterval(timer)
  })

  // 推播一次更新訊號（審核頁用）
  function broadcast() {
    channel?.postMessage('update')
  }

  // 訂閱更新（投影頁用）：即時推送 + 短輪詢 fallback
  function subscribe(onUpdate: () => void, pollMs = 5000) {
    if (channel)
      channel.onmessage = () => onUpdate()
    timer = setInterval(onUpdate, pollMs)
  }

  return { broadcast, subscribe }
}
