// app/composables/useSeatAssign.ts
// 拖曳排位（issue #73 自 seating.vue 拆出，行為不變）：
// HTML5 DnD 的拖曳來源狀態、入座／單席移動 API 操作與 drop 分派
import type { MaybeRefOrGetter } from 'vue'
import type { SeatingMath } from '~/composables/useSeatingMath'
import type { SeatGuestBody, TableListItem } from '~/types/api/seating'
import { moveSeat, seatGuest } from '~/api'

// 拖曳來源：側欄賓客無 from* 欄位；座位上的賓客帶 fromTableId / fromSeatNumber（供移動 / 互換）
interface DragSource { guestId: string, fromTableId?: string, fromSeatNumber?: number }

interface SeatAssignDeps {
  weddingId: MaybeRefOrGetter<string>
  math: Pick<SeatingMath, 'occupantAt' | 'nextSeatFor'>
  refreshAll: () => Promise<void>
}

export function useSeatAssign(deps: SeatAssignDeps) {
  const toast = useToast()
  const { occupantAt, nextSeatFor } = deps.math

  const dragSource = ref<DragSource | null>(null)
  const draggingGuestId = ref<string | null>(null)
  const dragOverTableId = ref<string | null>(null)

  function endDrag() {
    dragSource.value = null
    draggingGuestId.value = null
    dragOverTableId.value = null
  }

  // 拖曳操作成功不彈 toast（結果畫面直接可見），僅失敗提示
  async function assignSeat(tableId: string, guestId: string, seatNumber: number) {
    try {
      const body: SeatGuestBody = { guestId, seatNumber }
      await seatGuest(toValue(deps.weddingId), tableId, body)
      await deps.refreshAll()
    }
    catch (error: any) {
      const message = error?.data?.message || error?.statusMessage || '安排失敗，請稍後再試'
      toast.add({ title: '安排失敗', description: message, color: 'error' })
    }
  }

  // 單席移動／互換：以「席位」為粒度，一組賓客的大人、兒童椅席可各自移動；目標有人＝互換
  async function moveSingleSeat(fromTableId: string, fromSeatNumber: number, toTableId: string, toSeatNumber?: number) {
    try {
      await moveSeat(toValue(deps.weddingId), { fromTableId, fromSeatNumber, toTableId, toSeatNumber })
      await deps.refreshAll()
    }
    catch (error: any) {
      const message = error?.data?.message || error?.statusMessage || '移動失敗，請稍後再試'
      toast.add({ title: '移動失敗', description: message, color: 'error' })
      await deps.refreshAll()
    }
  }

  // 側欄賓客拖曳
  function onGuestDragStart(event: DragEvent, guestId: string) {
    dragSource.value = { guestId }
    draggingGuestId.value = guestId
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', guestId)
      event.dataTransfer.effectAllowed = 'move'
    }
  }
  // 座位上的賓客拖曳（供互換 / 移動）
  function onSeatDragStart(event: DragEvent, tableId: string, seatNumber: number, guestId: string) {
    dragSource.value = { guestId, fromTableId: tableId, fromSeatNumber: seatNumber }
    draggingGuestId.value = guestId
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', guestId)
      event.dataTransfer.effectAllowed = 'move'
    }
  }
  function onGuestDragEnd() {
    endDrag()
  }
  function onTableDragOver(event: DragEvent, tableId: string) {
    event.preventDefault()
    dragOverTableId.value = tableId
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = 'move'
  }
  function onTableDragLeave(tableId: string) {
    if (dragOverTableId.value === tableId)
      dragOverTableId.value = null
  }

  // 拖到整桌：座位上的席位→單席移到該桌下一個空號；側欄賓客→整組帶入（含兒童加位）
  async function onDropToTable(event: DragEvent, table: TableListItem) {
    event.preventDefault()
    const src = dragSource.value
    endDrag()
    if (!src)
      return
    if (src.fromTableId === table.tableId)
      return
    if (src.fromTableId && src.fromSeatNumber != null) {
      await moveSingleSeat(src.fromTableId, src.fromSeatNumber, table.tableId)
      return
    }
    const seat = nextSeatFor(table, src.guestId)
    if (seat == null) {
      toast.add({ title: '桌次已滿，無法再安排座位', color: 'error' })
      return
    }
    await assignSeat(table.tableId, src.guestId, seat)
  }

  // 拖到某座位：席位來源→單席移動（目標有人＝互換）；側欄賓客→整組帶入（已佔位改放下一個空位）
  async function onDropToSeat(event: DragEvent, table: TableListItem, seatNumber: number) {
    event.preventDefault()
    event.stopPropagation()
    const src = dragSource.value
    endDrag()
    if (!src)
      return
    if (src.fromTableId && src.fromSeatNumber != null) {
      // 拖回自己原位不動
      if (src.fromTableId === table.tableId && src.fromSeatNumber === seatNumber)
        return
      await moveSingleSeat(src.fromTableId, src.fromSeatNumber, table.tableId, seatNumber)
      return
    }
    const occupant = occupantAt(table.tableId, seatNumber)
    if (occupant) {
      // 側欄賓客拖到已佔位 → 改放該桌下一個空位（含兒童加位）
      const seat = nextSeatFor(table, src.guestId)
      if (seat == null) {
        toast.add({ title: '桌次已滿，無法再安排座位', color: 'error' })
        return
      }
      await assignSeat(table.tableId, src.guestId, seat)
      return
    }
    await assignSeat(table.tableId, src.guestId, seatNumber)
  }

  return {
    draggingGuestId,
    dragOverTableId,
    assignSeat,
    moveSingleSeat,
    onGuestDragStart,
    onSeatDragStart,
    onGuestDragEnd,
    onTableDragOver,
    onTableDragLeave,
    onDropToTable,
    onDropToSeat,
  }
}
