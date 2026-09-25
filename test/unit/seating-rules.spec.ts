import type { GuestListItem } from '../../app/types/api/guests'
import type { SeatListItem, TableListItem } from '../../app/types/api/seating'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { occupantColorClass, useSeatingMath } from '../../app/composables/useSeatingMath'
import { remainingPartyMembers, seatingHeads } from '../../app/utils/seatingRules'

function guest(guestId = 'family', diet: 'meat' | 'vegetarian' = 'meat', partySize = 5, childChairCount = 0): GuestListItem {
  return {
    guestId,
    diet,
    partySize,
    childChairCount,
    name: guestId,
    weddingId: 'w',
    side: 'groom',
    category: '',
    contact: '',
    notes: null,
    lineUserId: null,
    rsvpAttending: null,
    deletedAt: null,
  }
}
const table: TableListItem = { tableId: 'main', weddingId: 'w', tableName: '主桌', capacity: 10, positionX: 0, positionY: 0 }
const seatsFor = (g: GuestListItem, tableId = 'other'): SeatListItem[] => remainingPartyMembers(g, []).map((s, i) => ({ ...s, tableId, seatNumber: i + 1 }))

describe('拆分待排成員 #180', () => {
  it('五人入座、拆一人至主桌、取消後只補回該成員，原桌四人保留', () => {
    const g = guest()
    const allSeats = ref(seatsFor(g))
    const math = useSeatingMath({ tables: [table], guests: [g], allSeats })
    expect(math.unseatedCount.value).toBe(0)
    allSeats.value[2]!.tableId = 'main'
    expect(math.unseatedGuests.value).toHaveLength(0)
    allSeats.value = allSeats.value.filter(s => s.tableId !== 'main')
    expect(math.sidebarGuests.value.map(g => g.guestId)).toEqual(['family'])
    expect(math.pendingMembers(g.guestId)).toEqual([{ guestId: 'family', seatType: 'normal', partyIndex: 3 }])
    expect(math.seatedCount.value).toBe(4)
    expect(math.unseatedCount.value).toBe(1)
    allSeats.value.push({ ...math.pendingMembers(g.guestId)[0]!, tableId: 'main', seatNumber: 1 })
    expect(allSeats.value).toHaveLength(5)
    expect(math.pendingMembers(g.guestId)).toHaveLength(0)
  })

  it('正常席與兒童椅各自保留組內序號，不因同為序號 1 而漏算', () => {
    const g = guest('family', 'meat', 2, 1)
    expect(remainingPartyMembers(g, [seatsFor(g)[0]!])).toEqual([{ guestId: 'family', seatType: 'childChair', partyIndex: 1 }])
  })

  it('全為兒童椅的組別不憑空增加正常席', () => {
    const g = guest('kids', 'meat', 2, 2)
    const math = useSeatingMath({ tables: [table], guests: [g], allSeats: [] })
    expect(math.guestNormalHeads(g.guestId)).toBe(0)
  })
})

describe('葷素混合桌容量 #180', () => {
  const meat = guest('meat', 'meat', 10)
  const veg = guest('veg', 'vegetarian', 12)
  const dietOf = (id: string) => id === 'veg' ? 'vegetarian' : 'meat'
  it('10 葷＋12 素只計 10 席；移走全部葷食後改計 12 席', () => {
    const members = [...seatsFor(meat), ...seatsFor(veg)]
    expect(seatingHeads(members, dietOf)).toBe(10)
    expect(seatingHeads(seatsFor(veg), dietOf)).toBe(12)
  })
  it('混合桌可補素食，但不能補第 11 位葷食；全素桌仍受容量限制', () => {
    const extra = guest('extra', 'meat', 1)
    const allSeats = ref(seatsFor(meat, 'main'))
    const math = useSeatingMath({ tables: [table], guests: [meat, veg, extra], allSeats })
    expect(math.canSeatGuest(table, 'veg')).toBe(true)
    expect(math.canSeatGuest(table, 'extra')).toBe(false)
    allSeats.value = []
    expect(math.canSeatGuest(table, 'veg')).toBe(false)
  })
  it('素食兒童椅不重複扣席，座位環僅增加額外人數', () => {
    const veggie = guest('veg', 'vegetarian', 3, 1)
    const allSeats = [...seatsFor(meat, 'main'), ...seatsFor(veggie, 'main').map(s => ({ ...s, seatNumber: s.seatNumber + 10 }))]
    const math = useSeatingMath({ tables: [table], guests: [meat, veggie], allSeats })
    expect(math.tableNormalHeads('main')).toBe(10)
    expect(math.slotCount(table)).toBe(13)
    expect(math.seatSlots(table).filter(s => s.occupant)).toHaveLength(13)
  })
  it('舊稀疏座號不增加空位，所有人仍可見、可透過原座號取消', () => {
    const other = { ...table, tableId: 'other', tableName: '第二桌' }
    const allSeats = seatsFor(meat, 'other').slice(0, 2).map((s, i) => ({ ...s, seatNumber: 20 + i }))
    const math = useSeatingMath({ tables: [table, other], guests: [meat], allSeats })
    const slots = math.seatSlots(other)
    expect(slots).toHaveLength(10)
    expect(slots.filter(s => s.occupant).map(s => s.seatNumber)).toEqual([20, 21])
    expect(slots.filter(s => !s.occupant)).toHaveLength(8)
  })
  it('素食綠色、兒童椅紅色優先', () => {
    expect(occupantColorClass({ side: 'groom', seatType: 'normal', diet: 'vegetarian' })).toContain('border-success-600')
    expect(occupantColorClass({ side: 'bride', seatType: 'childChair', diet: 'vegetarian' })).toContain('border-error-600')
  })
})
