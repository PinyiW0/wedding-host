import type { H3Event } from 'h3'
import type { GuestSeatedEvent, SeatGuestBody } from '../../../../../../../../app/types/api/seating'

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
  if (mockSeats.filter(s => s.tableId === tableId).length >= table.capacity) {
    throw createError({ statusCode: 409, statusMessage: '桌次已滿，無法再安排座位' })
  }
  mockSeats.push({ tableId, guestId: body.guestId, seatNumber: body.seatNumber })

  setResponseStatus(event, 201)
  return { tableId, guestId: body.guestId, seatNumber: body.seatNumber }
})
