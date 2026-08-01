// app/composables/useGuestNav.ts
// 賓客公開頁導覽（issue #132）：依當前連結的簽名等級決定可導覽的目的地。
// 簽名格式見 server/utils/guest-link.ts —— 婚禮級 w.<digest> 只通行婚禮層級分享頁；
// 賓客級 g.<guestId>.<digest> 另可通行賓客專屬頁（個人 RSVP／自助報到／謝卡／LINE 綁定）。
// 導覽時 sig 必須沿路帶著，否則 useHttp 的 sigHeaders() 取不到簽名、API 回 401。
// 各目的地的參數形態與 GuestLinkCenter.vue 發出的連結一致。

export interface GuestNavItem {
  key: string
  label: string
  to: string
}

function firstString(value: unknown): string {
  if (Array.isArray(value))
    return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

export function useGuestNav() {
  const route = useRoute()

  const sig = computed(() => firstString(route.query.sig))

  // 賓客級簽名自帶 guestId：連結未帶 guestId query 時仍能識別身分
  const sigGuestId = computed(() => {
    const parts = sig.value.split('.')
    return parts[0] === 'g' && parts.length === 3 ? parts[1]! : ''
  })

  const weddingId = computed(() =>
    firstString(route.params.weddingId) || firstString(route.query.weddingId))

  const guestId = computed(() =>
    firstString(route.params.guestId) || firstString(route.query.guestId) || sigGuestId.value)

  // 婚禮級簽名點進賓客專屬頁必定 401，所以個人入口只在賓客級簽名時給出。
  // 無簽名（本機 authMode 非 enforced）則退回看連結有沒有帶 guestId。
  const isGuestScoped = computed(() =>
    sig.value ? sig.value.startsWith('g.') : Boolean(guestId.value))

  function withQuery(path: string, params: Record<string, string>): string {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value)
        query.set(key, value)
    }
    const search = query.toString()
    return search ? `${path}?${search}` : path
  }

  // 出席回覆：賓客級走個人頁（帶得出既有回覆），婚禮級走公開表單
  const ctaItem = computed<GuestNavItem | null>(() => {
    if (!weddingId.value)
      return null
    if (isGuestScoped.value && guestId.value) {
      return {
        key: 'rsvp',
        label: '出席回覆',
        to: withQuery(`/rsvp/${guestId.value}`, { weddingId: weddingId.value, sig: sig.value }),
      }
    }
    return {
      key: 'rsvp-public',
      label: '出席回覆',
      to: withQuery(`/rsvp/public/${weddingId.value}`, { sig: sig.value }),
    }
  })

  // 依婚禮時序排列：流程 → 當天報到 → 祝福 → 婚後謝卡 → 通知綁定
  const menuItems = computed<GuestNavItem[]>(() => {
    const wid = weddingId.value
    if (!wid)
      return []

    const gid = guestId.value
    const personal = isGuestScoped.value && Boolean(gid)
    const items: GuestNavItem[] = [
      { key: 'rundown', label: '婚禮流程', to: withQuery(`/rundown/${wid}`, { sig: sig.value }) },
    ]

    if (personal)
      items.push({ key: 'checkin', label: '自助報到', to: withQuery('/checkin', { weddingId: wid, guestId: gid, sig: sig.value }) })

    // 祝福牆共用 QR 無 guestId 時改由賓客自填姓名，故 guestId 僅在賓客級連結帶入
    items.push({ key: 'blessing', label: '祝福留言', to: withQuery(`/blessing/${wid}`, { guestId: personal ? gid : '', sig: sig.value }) })

    if (personal) {
      items.push({ key: 'thankyou', label: '感謝卡', to: withQuery(`/thankyou/${wid}/${gid}`, { sig: sig.value }) })
      items.push({ key: 'bind', label: 'LINE 通知', to: withQuery(`/guest/${gid}/bind`, { weddingId: wid, sig: sig.value }) })
    }

    return items
  })

  // logo 導回：優先回出席回覆，其次流程表；兩者都組不出（缺 weddingId）就不做連結
  const homeTo = computed(() => ctaItem.value?.to ?? menuItems.value[0]?.to ?? '')

  function isCurrent(to: string): boolean {
    return to.split('?')[0] === route.path
  }

  return { weddingId, guestId, sig, isGuestScoped, menuItems, ctaItem, homeTo, isCurrent }
}
