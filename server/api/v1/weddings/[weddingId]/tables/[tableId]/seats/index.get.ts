import type { H3Event } from 'h3'
import type { SeatListItem } from '../../../../../../../../app/types/api/seating'

import { mockSeats } from '../../../../../../../mock/data/seating'

export default defineEventHandler((event: H3Event): SeatListItem[] => {
  const tableId = getRouterParam(event, 'tableId')
  return mockSeats
    .filter(s => s.tableId === tableId)
    .map(s => ({ guestId: s.guestId, tableId: s.tableId, seatNumber: s.seatNumber }))
})
