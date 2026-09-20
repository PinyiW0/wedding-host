import type { Db } from '../db'

import { eq, inArray } from 'drizzle-orm'

import { guests, seats } from '../db/schema'

interface PartyShape {
  partySize: number
  childChairCount: number
}

// released = 整組退回待排席；trimmed = 就地移除多餘席位；unchanged = 沒動座位
export type SeatSyncResult = 'unchanged' | 'released' | 'trimmed'

// 賓客自行透過 RSVP 改人數後同步座位（issue #174）。
// 人變多：原本的排法已不成立（原桌未必塞得下），整組退回待排席由新人重新決定位置，
//         並記下 seatReleasedAt——否則桌位圖只會安靜地少一組人，新人不會發現。
// 人變少：原位子還坐得下，就地移除多餘席位（partyIndex 高者先移除，座位標籤不跳號），
//         保留已排好的位置，不打擾新人。
// 後台 PATCH 走自己的「同桌塞得下就補、塞不下整組退回」邏輯，刻意不共用此函式：
// 管理員是當下盯著桌位圖操作，自動補位比較順手。
export async function syncSeatsOnPartyChange(db: Db, guestId: string, prev: PartyShape, next: PartyShape): Promise<SeatSyncResult> {
  const prevNormal = Math.max(0, prev.partySize - prev.childChairCount)
  const nextNormal = Math.max(0, next.partySize - next.childChairCount)
  if (prevNormal === nextNormal && prev.childChairCount === next.childChairCount)
    return 'unchanged'

  const partySeats = await db.select().from(seats).where(eq(seats.guestId, guestId))
  if (!partySeats.length)
    return 'unchanged'

  // 任一類別席次增加 → 整組退回待排席
  if (nextNormal > prevNormal || next.childChairCount > prev.childChairCount) {
    await db.delete(seats).where(eq(seats.guestId, guestId))
    await db.update(guests).set({ seatReleasedAt: new Date().toISOString() }).where(eq(guests.guestId, guestId))
    return 'released'
  }

  // 席次只減不增 → 釋出多餘席位，原本排好的位置留著
  const normal = partySeats.filter(s => s.seatType === 'normal').sort((a, b) => a.partyIndex - b.partyIndex)
  const child = partySeats.filter(s => s.seatType === 'childChair').sort((a, b) => a.partyIndex - b.partyIndex)
  const toRemove = [...normal.slice(nextNormal), ...child.slice(next.childChairCount)]
  if (toRemove.length)
    await db.delete(seats).where(inArray(seats.seq, toRemove.map(s => s.seq)))
  return 'trimmed'
}

// 重新入座 / 手動取消座位時清掉退回記號，避免側欄一直掛著舊提示
export async function clearSeatReleasedMark(db: Db, guestId: string): Promise<void> {
  await db.update(guests).set({ seatReleasedAt: null }).where(eq(guests.guestId, guestId))
}
