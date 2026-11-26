import type { MaybeRefOrGetter } from 'vue'

// 投影即時推送（mock）：審核頁 approve / project → 投影頁即時更新
// 機制：BroadcastChannel（同瀏覽器跨分頁）+ 短輪詢 fallback；不改 SSE/WebSocket（決策見 docs/architecture.md §3.5「接待台即時性」）
export function useProjectionChannel(weddingId: MaybeRefOrGetter<string>) {
  let channel: BroadcastChannel | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let onVisible: (() => void) | null = null

  onMounted(() => {
    if (typeof BroadcastChannel !== 'undefined')
      channel = new BroadcastChannel(`projection-${toValue(weddingId)}`)
  })

  onBeforeUnmount(() => {
    channel?.close()
    channel = null
    if (timer)
      clearInterval(timer)
    if (onVisible)
      document.removeEventListener('visibilitychange', onVisible)
  })

  // 推播一次更新訊號（審核頁用）
  function broadcast() {
    channel?.postMessage('update')
  }

  // 訂閱更新（投影頁用）：即時推送 + 短輪詢 fallback
  function subscribe(onUpdate: () => void, pollMs = 5000) {
    if (channel)
      channel.onmessage = () => onUpdate()
    // 分頁在背景時不輪詢（issue #224）：沒人在看的投影頁不該持續向資料庫要資料；回到前景時立刻補一次
    timer = setInterval(() => {
      if (document.visibilityState === 'visible')
        onUpdate()
    }, pollMs)
    onVisible = () => {
      if (document.visibilityState === 'visible')
        onUpdate()
    }
    document.addEventListener('visibilitychange', onVisible)
  }

  return { broadcast, subscribe }
}
