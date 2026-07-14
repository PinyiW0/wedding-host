// app/composables/useSeatingMath.ts
// 座位計算純邏輯（issue #73 自 seating.vue 拆出，行為不變）：
// occupant 展開、容量人頭計算、主桌男左女右排列、側欄排序與統計
import type { MaybeRefOrGetter } from 'vue'
import type { GuestDiet, GuestListItem, GuestSide } from '~/types/api/guests'
import type { SeatListItem, TableListItem } from '~/types/api/seating'

export const sideLabel = (s: GuestSide) => (s === 'groom' ? '男方' : '女方')
export const dietLabel = (d: GuestDiet) => (d === 'meat' ? '葷食' : '素食')

// 座位顏色：兒童椅席綠色，否則依男方／女方區分（非性別、是家屬方）
export function occupantColorClass(o: { side: GuestSide | null, seatType: 'normal' | 'childChair' }): string {
  if (o.seatType === 'childChair')
    return 'border-success-600 bg-success-100 text-success-700 dark:bg-success-900/40'
  if (o.side === 'bride')
    return 'border-gold bg-gold-light/50 text-gold-deep'
  return 'border-info-600 bg-info-100 text-info-700 dark:bg-info-900/40'
}

// 名單姓名顏色：有兒童椅嬰兒者標綠，否則女方金 / 男方藍
export function nameColorClass(g: GuestListItem): string {
  if (g.childChairCount > 0)
    return 'text-success-700'
  return g.side === 'bride' ? 'text-gold-deep' : 'text-info-700'
}

// 賓客側欄顯示用：哪一方 · 關係 · 葷素（接在姓名後同一排）
export function guestMeta(g: GuestListItem): string {
  const parts = [sideLabel(g.side)]
  if (g.category)
    parts.push(g.category)
  parts.push(dietLabel(g.diet))
  return parts.join(' · ')
}

// 主桌專屬賓客：新郎新娘（新人）與雙方父母（雙親），推薦排序時優先帶入主桌
export function isMainTableGuest(g: GuestListItem): boolean {
  return g.category === '新人' || g.category === '雙親'
}

// 縱向尊卑分層（數字小＝越靠主桌/舞台）：新人 → 家屬長輩 → 主管摯友 → 一般同學同事
const FAMILY_CATEGORY_RE = /雙親|父母|家人|家屬|長輩|親戚/
const VIP_CATEGORY_RE = /主管|貴賓|vip|摯友|朋友/i
export function seniorityTier(category: string): number {
  if (category === '新人')
    return 0
  if (FAMILY_CATEGORY_RE.test(category))
    return 1
  if (VIP_CATEGORY_RE.test(category))
    return 2
  return 3
}

export const SIDE_ORDER: Record<GuestSide, number> = { groom: 0, bride: 1 }
// 素食優先（盡量排同一桌）：素食 0、葷食 1
export const DIET_ORDER: Record<GuestDiet, number> = { vegetarian: 0, meat: 1 }

// 排序：男方/女方 → 尊卑分層（長輩近主桌）→ 素食優先 → 分類 → 姓名
// （先分男女方分桌；同方內長輩家屬在前、一般同事同學在後；素食集中同桌；同類別相鄰）
export function bySeatingPriority(a: GuestListItem, b: GuestListItem) {
  return SIDE_ORDER[a.side] - SIDE_ORDER[b.side]
    || seniorityTier(a.category) - seniorityTier(b.category)
    || DIET_ORDER[a.diet] - DIET_ORDER[b.diet]
    || a.category.localeCompare(b.category, 'zh-Hant')
    || a.name.localeCompare(b.name, 'zh-Hant')
}

// 環繞圓桌的座位座標（百分比，從正上方順時針排列）。
// offsetRad：整體旋轉角；主桌傳 -π/count 旋半格，使兩個座位對稱跨在正上方（新人並排 C 位）。
export function seatPositions(count: number, offsetRad = 0) {
  const positions: { left: string, top: string }[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2 + offsetRad
    positions.push({
      left: `${(50 + 50 * Math.cos(angle)).toFixed(2)}%`,
      top: `${(50 + 50 * Math.sin(angle)).toFixed(2)}%`,
    })
  }
  return positions
}

interface SeatingMathDeps {
  tables: MaybeRefOrGetter<TableListItem[] | null | undefined>
  guests: MaybeRefOrGetter<GuestListItem[] | null | undefined>
  allSeats: MaybeRefOrGetter<SeatListItem[] | null | undefined>
}

export function useSeatingMath(deps: SeatingMathDeps) {
  const tables = computed(() => toValue(deps.tables) ?? [])
  const guests = computed(() => toValue(deps.guests) ?? [])
  const allSeats = computed(() => toValue(deps.allSeats) ?? [])

  const activeGuests = computed(() => guests.value.filter(g => !g.deletedAt))

  // 每張桌的座位（key = tableId；每桌保證有 key，無座位為空陣列）
  const seatsByTable = computed<Record<string, SeatListItem[]>>(() => {
    const map: Record<string, SeatListItem[]> = {}
    for (const t of tables.value)
      map[t.tableId] = []
    for (const s of allSeats.value)
      (map[s.tableId] ??= []).push(s)
    return map
  })

  function guestName(guestId: string): string {
    return activeGuests.value.find(g => g.guestId === guestId)?.name ?? guestId
  }

  function guestSide(guestId: string): GuestSide | null {
    return activeGuests.value.find(g => g.guestId === guestId)?.side ?? null
  }

  function guestById(guestId: string): GuestListItem | undefined {
    return activeGuests.value.find(g => g.guestId === guestId)
  }

  function tableSeats(tableId: string): SeatListItem[] {
    return seatsByTable.value[tableId] ?? []
  }

  const mainTable = computed(() =>
    tables.value.find(t => t.tableName.includes('主桌')) ?? tables.value[0] ?? null,
  )
  function isMainTable(table: TableListItem): boolean {
    return mainTable.value?.tableId === table.tableId
  }

  // 視角：以舞台為上方、面向賓客（由上往下看）。桌位中心 X 供左右分流：中軸線左＝男方、右＝女方
  function tableCenterX(table: TableListItem): number {
    return table.positionX + (isMainTable(table) ? 100 : 84)
  }

  // 由席位資料建出顯示用入座者；label 依類型展開為「名字N」/「名字-兒童N」
  function buildOccupant(seat: SeatListItem) {
    const name = guestName(seat.guestId)
    return {
      guestId: seat.guestId,
      name,
      label: seat.seatType === 'childChair' ? `${name}-兒童${seat.partyIndex}` : `${name}${seat.partyIndex}`,
      side: guestSide(seat.guestId),
      seatType: seat.seatType,
      seatNumber: seat.seatNumber,
    }
  }

  // 某桌某座位號的入座席位（無人則 null）；供拖放交換／移動時反查
  function occupantAt(tableId: string, seatNumber: number) {
    const seat = tableSeats(tableId).find(s => s.seatNumber === seatNumber)
    return seat ? buildOccupant(seat) : null
  }

  // 圓桌要畫幾個座位：至少 capacity，若有展開座位（座號 > capacity）則一併畫出
  function slotCount(table: TableListItem): number {
    const maxSeat = tableSeats(table.tableId).reduce((m, s) => Math.max(m, s.seatNumber), 0)
    return Math.max(table.capacity, maxSeat)
  }

  // 該桌已用正常席人頭（兒童椅不計）
  function tableNormalHeads(tableId: string): number {
    return tableSeats(tableId).filter(s => s.seatType === 'normal').length
  }
  // 此賓客組的正常席人頭 = partySize − 兒童椅嬰兒數（至少 1）
  function guestNormalHeads(guestId: string): number {
    const g = guestById(guestId)
    return Math.max(1, (g?.partySize ?? 1) - (g?.childChairCount ?? 0))
  }
  // 此桌容得下此賓客組嗎（正常席人頭不超過 capacity；兒童椅額外不計）
  function canSeatGuest(table: TableListItem, guestId: string): boolean {
    return tableNormalHeads(table.tableId) + guestNormalHeads(guestId) <= table.capacity
  }

  // 下一個空號（該桌最小未占用座號；後端亦以此起點往上填空號）
  function nextFreeSeat(table: TableListItem): number {
    const occupied = new Set(tableSeats(table.tableId).map(s => s.seatNumber))
    let n = 1
    while (occupied.has(n))
      n++
    return n
  }

  // 該賓客可入座則回起始座號；正常席不足回 null。
  function nextSeatFor(table: TableListItem, guestId: string): number | null {
    return canSeatGuest(table, guestId) ? nextFreeSeat(table) : null
  }

  // 主桌入座者的角色排序：新人(0) → 雙親(1) → 其他家屬(2)
  function mainSeatRoleRank(guestId: string): number {
    const category = guestById(guestId)?.category
    if (category === '新人')
      return 0
    if (category === '雙親')
      return 1
    return 2
  }

  // 某桌「視覺位置 → 入座者」排列。
  // 主桌特別處理：新郎在最靠舞台頂端、新娘並排於其左側；新郎側家屬順時針向右外擴、新娘側家屬逆時針向左外擴。
  // 其餘桌維持依座號環繞。回傳含座標、入座者與供拖放用的座位號。
  function seatSlots(table: TableListItem) {
    const n = slotCount(table)
    const isMain = isMainTable(table)
    // 主桌旋半格，使兩個座位對稱跨在正上方（新人並排於最靠舞台的 C 位）
    const positions = seatPositions(n, isMain ? -Math.PI / n : 0)
    const seats = [...tableSeats(table.tableId)].sort((a, b) => a.seatNumber - b.seatNumber)
    const occupants = Array.from<ReturnType<typeof buildOccupant> | null>({ length: n }).fill(null)

    if (isMain) {
      const sideRoleSort = (a: SeatListItem, b: SeatListItem) =>
        mainSeatRoleRank(a.guestId) - mainSeatRoleRank(b.guestId) || a.seatNumber - b.seatNumber
      const groom = seats.filter(s => guestSide(s.guestId) === 'groom').sort(sideRoleSort)
      const bride = seats.filter(s => guestSide(s.guestId) === 'bride').sort(sideRoleSort)
      const rest = seats.filter(s => guestSide(s.guestId) == null)
      // 全場統一男左女右：新郎(男方)填左半 → 頂端左座(0) 再往左下(n-1, n-2…)；
      // 新娘(女方)填右半 → 頂端右座(1) 再往右下(2, 3…)。新郎新娘並排於正上方中央。
      const groomOrder = [0, ...Array.from({ length: n - 1 }, (_, k) => n - 1 - k)]
      const brideOrder = Array.from({ length: n - 1 }, (_, k) => k + 1)
      const fillSide = (list: SeatListItem[], order: number[]) => {
        let p = 0
        for (const s of list) {
          while (p < order.length && occupants[order[p]!] != null)
            p++
          if (p < order.length)
            occupants[order[p++]!] = buildOccupant(s)
        }
      }
      fillSide(groom, groomOrder)
      fillSide(bride, brideOrder)
      for (const s of rest) {
        const slot = occupants.findIndex(x => x == null)
        if (slot >= 0)
          occupants[slot] = buildOccupant(s)
      }
    }
    else {
      for (const s of seats) {
        if (s.seatNumber >= 1 && s.seatNumber <= n)
          occupants[s.seatNumber - 1] = buildOccupant(s)
      }
    }

    return positions.map((pos, idx) => ({
      idx,
      pos,
      occupant: occupants[idx],
      // 已入座用實際座號（供交換／取消反查）；空位：一般桌用該視覺位置的座號（拖入即落位），主桌座號與視覺位置脫鉤、用最小空號
      seatNumber: occupants[idx]?.seatNumber ?? (isMain ? nextFreeSeat(table) : idx + 1),
    }))
  }

  // 已入座者 hover 提示：哪一方 · 關係 · 葷素（姓名已顯示在座位上，不重複以免撞 getByText）
  function occupantMeta(guestId: string): string {
    const g = guestById(guestId)
    if (!g)
      return ''
    return `${sideLabel(g.side)} · ${g.category} · ${dietLabel(g.diet)}`
  }

  // === 賓客名單側欄：待排席 ===
  const seatedGuestIds = computed(() => {
    const ids = new Set<string>()
    for (const seats of Object.values(seatsByTable.value)) {
      for (const s of seats)
        ids.add(s.guestId)
    }
    return ids
  })
  const unseatedGuests = computed(() =>
    activeGuests.value.filter(g => !seatedGuestIds.value.has(g.guestId)),
  )
  const seatedCount = computed(() => activeGuests.value.length - unseatedGuests.value.length)

  // 側欄固定依男女方→分類分群顯示，方便辨識
  const sidebarGuests = computed(() => [...unseatedGuests.value].sort(bySeatingPriority))

  return {
    activeGuests,
    seatsByTable,
    guestName,
    guestSide,
    guestById,
    tableSeats,
    mainTable,
    isMainTable,
    tableCenterX,
    buildOccupant,
    occupantAt,
    slotCount,
    tableNormalHeads,
    guestNormalHeads,
    canSeatGuest,
    nextFreeSeat,
    nextSeatFor,
    seatSlots,
    occupantMeta,
    seatedGuestIds,
    unseatedGuests,
    seatedCount,
    sidebarGuests,
  }
}

export type SeatingMath = ReturnType<typeof useSeatingMath>
export type SeatOccupant = NonNullable<ReturnType<SeatingMath['occupantAt']>>
export type SeatSlot = ReturnType<SeatingMath['seatSlots']>[number]
