// app/composables/useSignedLink.ts
// 公開頁（故事、喜帖、相簿）之間的連結要把網址上的婚禮簽章（?sig=）帶下去。
// 這幾頁自己不打 API，但賓客一路點到出席回覆時，RSVP 頁要憑這個簽章才過得了正式站的 enforced 模式；
// 中間任何一頁的連結沒帶，簽章就在那一跳掉了（PR #159 Copilot 審查：相簿系列卡、喜帖場景都曾漏帶）。
// 本機 open 模式網址上沒有 sig，連結維持原樣。

export function useSignedLink() {
  const route = useRoute()
  const sig = computed(() => (typeof route.query.sig === 'string' ? route.query.sig : ''))

  /** 頁內錨點（#...）不帶；已經有 query 的路徑用 & 接 */
  function withSig(path: string): string {
    if (!sig.value || path.startsWith('#'))
      return path
    return `${path}${path.includes('?') ? '&' : '?'}sig=${encodeURIComponent(sig.value)}`
  }

  return { sig, withSig }
}
