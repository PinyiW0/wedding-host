// app/composables/useAutoSeat.ts
// 推薦排序（issue #73 自 seating.vue 拆出，行為不變）：
// 依「主桌帶入新人雙親 × 男左女右 × 長輩近主桌」自動帶入座位
// 規則：① 主桌先帶入新郎新娘與雙方父母（最靠舞台的 C 位）；② 男方親友排中軸線左側、女方排右側；
//      ③ 同側內長輩家屬靠前（近主桌）、一般同學同事靠後；④ 某側專屬桌不足時跨界外溢到後方桌。
import type { MaybeRefOrGetter } from 'vue'
import type { SeatingMath } from '~/composables/useSeatingMath'
import type { GuestListItem } from '~/types/api/guests'
import type { TableListItem } from '~/types/api/seating'
import { seatGuest } from '~/api'
import { DIET_ORDER, isMainTableGuest, seniorityTier, SIDE_ORDER } from '~/composables/useSeatingMath'

interface AutoSeatDeps {
  weddingId: MaybeRefOrGetter<string>
  tables: MaybeRefOrGetter<TableListItem[] | null | undefined>
  math: Pick<SeatingMath, 'unseatedGuests' | 'mainTable' | 'isMainTable' | 'tableSeats' | 'guestNormalHeads' | 'tableCenterX'>
  refreshAll: () => Promise<void>
}

export function useAutoSeat(deps: AutoSeatDeps) {
  const toast = useToast()
  const { unseatedGuests, mainTable, isMainTable, tableSeats, guestNormalHeads, tableCenterX } = deps.math

  const isAutoSeating = ref(false)

  async function autoSeat() {
    if (isAutoSeating.value)
      return
    const pending = [...unseatedGuests.value]
    if (pending.length === 0) {
      toast.add({ title: '沒有待排席的賓客', color: 'info' })
      return
    }
    const allTables = toValue(deps.tables) ?? []
    const main = mainTable.value
    const fillTables = allTables.filter(t => !isMainTable(t))
    if (!main && fillTables.length === 0) {
      toast.add({ title: '沒有可安排的桌次', description: '請先新增桌次', color: 'warning' })
      return
    }

    isAutoSeating.value = true
    try {
      // 各桌目前已用正常席人頭（推薦排序在既有座位上接續安排，兒童椅額外不計）
      const usedNormal: Record<string, number> = {}
      for (const t of allTables)
        usedNormal[t.tableId] = tableSeats(t.tableId).filter(s => s.seatType === 'normal').length
      const canFit = (table: TableListItem, guestId: string): boolean =>
        usedNormal[table.tableId]! + guestNormalHeads(guestId) <= table.capacity
      const plan: { tableId: string, guestId: string }[] = []
      const assign = (table: TableListItem, guest: GuestListItem) => {
        usedNormal[table.tableId]! += guestNormalHeads(guest.guestId)
        plan.push({ tableId: table.tableId, guestId: guest.guestId })
      }

      // ① 主桌：先帶入新郎新娘（新人）與雙方父母（雙親）；新郎→新娘→父母依序送出，最靠舞台先排
      if (main) {
        const mainGuests = pending
          .filter(isMainTableGuest)
          .sort((a, b) =>
            seniorityTier(a) - seniorityTier(b)
            || SIDE_ORDER[a.side] - SIDE_ORDER[b.side]
            || a.name.localeCompare(b.name, 'zh-Hant'))
        for (const g of mainGuests) {
          if (canFit(main, g.guestId))
            assign(main, g)
        }
      }

      // ② 其餘賓客：左右分流 + 縱向尊卑（已排進主桌者排除）
      const restSort = (a: GuestListItem, b: GuestListItem) =>
        SIDE_ORDER[a.side] - SIDE_ORDER[b.side]
        || seniorityTier(a) - seniorityTier(b)
        || DIET_ORDER[a.diet] - DIET_ORDER[b.diet]
        || a.name.localeCompare(b.name, 'zh-Hant')
      const planned = new Set(plan.map(p => p.guestId))
      const rest = pending.filter(g => !planned.has(g.guestId)).sort(restSort)

      // 中軸線：以可填入桌的中心 X 取中點，左側＝男方區、右側＝女方區
      const centers = fillTables.map(tableCenterX)
      const axisX = centers.length ? (Math.min(...centers) + Math.max(...centers)) / 2 : 0
      const byFront = (a: TableListItem, b: TableListItem) => a.positionY - b.positionY // Y 小＝靠主桌/舞台＝前排
      const leftTables = fillTables.filter(t => tableCenterX(t) <= axisX).sort(byFront)
      const rightTables = fillTables.filter(t => tableCenterX(t) > axisX).sort(byFront)
      const backmost = [...fillTables].sort((a, b) => b.positionY - a.positionY) // 跨界外溢優先靠後方

      const pickTable = (guest: GuestListItem): TableListItem | null => {
        // 同側專屬區由前往後找第一張坐得下的（長輩已排前面、自然落在靠主桌的前排桌）
        const zone = guest.side === 'groom' ? leftTables : rightTables
        const inZone = zone.find(t => canFit(t, guest.guestId))
        if (inZone)
          return inZone
        // 該側桌不足 → 跨界外溢到後方任一坐得下的桌
        return backmost.find(t => canFit(t, guest.guestId)) ?? null
      }

      for (const g of rest) {
        const table = pickTable(g)
        if (table)
          assign(table, g)
      }

      // 逐筆送出（座號交由後端接續展開，避免同桌併發超賣）
      for (const a of plan)
        await seatGuest(toValue(deps.weddingId), a.tableId, { guestId: a.guestId, seatNumber: 1 })
      await deps.refreshAll()

      const remain = pending.length - plan.length
      const mainCount = plan.filter(p => p.tableId === main?.tableId).length
      const mainNote = mainCount > 0 ? `主桌帶入 ${mainCount} 位主角／雙親，` : ''
      toast.add({
        title: `已自動帶入 ${plan.length} 位`,
        description: remain > 0
          ? `${mainNote}尚有 ${remain} 位待排席（桌次不足）`
          : `${mainNote}其餘依男左女右、長輩近主桌分流`,
        color: 'success',
      })
    }
    catch (error: any) {
      const message = error?.data?.message || error?.statusMessage || '請稍後再試'
      toast.add({ title: '自動帶入失敗', description: message, color: 'error' })
      await deps.refreshAll()
    }
    finally {
      isAutoSeating.value = false
    }
  }

  return { isAutoSeating, autoSeat }
}
