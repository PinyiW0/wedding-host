// app/composables/useSignedLink.ts
// 公開頁（故事、喜帖、相簿）之間的連結要把網址上的婚禮簽章（?sig=）帶下去。
// 這幾頁幾乎不打 API（只有故事頁的花田讀 listFlowers），但賓客一路點到出席回覆時，
// RSVP 頁要憑這個簽章才過得了正式站的 enforced 模式；
// 中間任何一頁的連結沒帶，簽章就在那一跳掉了（PR #159 Copilot 審查：相簿系列卡、喜帖場景都曾漏帶）。
// 本機 open 模式網址上沒有 sig，連結維持原樣。

export function useSignedLink() {
  const route = useRoute()
  const sig = computed(() => (typeof route.query.sig === 'string' ? route.query.sig : ''))

  /** 把簽章接到路徑上；已經有 query 的用 & 接，錨點一律留在最後面 */
  function withSig(path: string): string {
    if (!sig.value)
      return path
    // 頁內錨點（選單的「婚宴資訊」、相簿的系列）要補上目前的路徑再帶簽章。
    // 只給 "#..." 的話 Vue Router 會把網址上的 query 整組丟掉，簽章就在點下去的那一刻消失，
    // 之後每個連結都組不出簽章、API 全部 403（2026-09-16 上線當天實際發生，見 docs §64）
    const target = path.startsWith('#') ? `${route.path}${path}` : path
    const hashAt = target.indexOf('#')
    const base = hashAt === -1 ? target : target.slice(0, hashAt)
    const hash = hashAt === -1 ? '' : target.slice(hashAt)
    return `${base}${base.includes('?') ? '&' : '?'}sig=${encodeURIComponent(sig.value)}${hash}`
  }

  return { sig, withSig }
}
