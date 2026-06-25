import type { H3Event } from 'h3'
import type { GuestSeatedEvent, SeatGuestBody } from '../../../../../../../../app/types/api/seating'

import { mockGuests } from '../../../../../../../mock/data/guests'
import { mockSeats, mockTables } from '../../../../../../../mock/data/seating'

export default defineEventHandler(async (event: H3Event): Promise<GuestSeatedEvent> => {
  const tableId = getRouterParam(event, 'tableId')!
  const body = await readBody<SeatGuestBody>(event)

  const table = mockTables.find(t => t.tableId === tableId)
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  if (mockSeats.some(s => s.guestId === body.guestId)) {
    throw createError({ statusCode: 409, statusMessage: '賓客已有座位' })
  }
  // 容量規則（人頭）：正常席人頭 = partySize − childChairCount，至多坐滿 capacity；
  // 兒童椅嬰兒不佔正常席、該桌額外加位（不受 capacity 限制）
  const guest = mockGuests.find(g => g.guestId === body.guestId)
  const partySize = guest?.partySize ?? 1
  const childChairCount = guest?.childChairCount ?? 0
  const normalHeads = Math.max(0, partySize - childChairCount)
  const existingNormal = mockSeats.filter(s => s.tableId === tableId && s.seatType === 'normal').length
  if (existingNormal + normalHeads > table.capacity) {
    throw createError({ statusCode: 409, statusMessage: '桌次已滿，無法再安排座位' })
  }

  // 將一組賓客展開為多筆座位：正常席 N 筆 + 兒童椅 M 筆，座號接續該桌現有最大座號
  const maxSeat = mockSeats
    .filter(s => s.tableId === tableId)
    .reduce((m, s) => Math.max(m, s.seatNumber), 0)
  let seatNo = Math.max(body.seatNumber || 1, maxSeat + 1)
  for (let i = 1; i <= normalHeads; i++) {
    mockSeats.push({ tableId, guestId: body.guestId, seatNumber: seatNo, seatType: 'normal', partyIndex: i })
    seatNo++
  }
  for (let i = 1; i <= childChairCount; i++) {
    mockSeats.push({ tableId, guestId: body.guestId, seatNumber: seatNo, seatType: 'childChair', partyIndex: i })
    seatNo++
  }

  setResponseStatus(event, 201)
  return { tableId, guestId: body.guestId, seatNumber: body.seatNumber }
})
