// 前後端共用：成員以組別＋席位類型＋組內序號識別，跨桌不改變身分。
export interface PartyMember {
  guestId: string
  seatType: 'normal' | 'childChair'
  partyIndex: number
}

export function remainingPartyMembers(
  guest: { guestId: string, partySize: number, childChairCount: number },
  seated: readonly PartyMember[],
): PartyMember[] {
  const occupied = new Set(seated.filter(s => s.guestId === guest.guestId).map(s => `${s.seatType}:${s.partyIndex}`))
  const members: PartyMember[] = []
  const children = Math.min(guest.partySize, guest.childChairCount)
  for (const [seatType, count] of [['normal', guest.partySize - children], ['childChair', children]] as const) {
    for (let partyIndex = 1; partyIndex <= count; partyIndex++) {
      if (!occupied.has(`${seatType}:${partyIndex}`))
        members.push({ guestId: guest.guestId, seatType, partyIndex })
    }
  }
  return members
}

// 混合桌只計葷食正常席；全素桌計素食正常席；兒童椅永遠額外加位。
// 不明飲食以葷食計，避免低估容量。
export function seatingHeads(
  members: readonly Pick<PartyMember, 'guestId' | 'seatType'>[],
  dietOf: (guestId: string) => string | undefined,
): number {
  const allVegetarian = members.length > 0 && members.every(s => dietOf(s.guestId) === 'vegetarian')
  return members.filter(s => s.seatType === 'normal' && (allVegetarian || dietOf(s.guestId) !== 'vegetarian')).length
}

// 按同一組待排成員的順序填入可容納的部分；遇到正常席不足就停止，
// 後續成員（含兒童椅）留待下一桌，避免只把兒童椅單獨排進滿桌。
export function fittingPartyMembers(
  pending: readonly PartyMember[],
  seated: readonly PartyMember[],
  capacity: number,
  dietOf: (guestId: string) => string | undefined,
): PartyMember[] {
  const fitting: PartyMember[] = []
  for (const member of pending) {
    if (seatingHeads([...seated, ...fitting, member], dietOf) > capacity)
      break
    fitting.push(member)
  }
  return fitting
}
