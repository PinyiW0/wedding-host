import type { PartyMember } from '../../app/utils/seatingRules'
import type { Db } from '../db'
import { eq } from 'drizzle-orm'
import { seatingHeads } from '../../app/utils/seatingRules'
import { guests } from '../db/schema'

export async function seatingDietLookup(db: Db, weddingId: string) {
  const rows = await db.select({ guestId: guests.guestId, diet: guests.diet }).from(guests).where(eq(guests.weddingId, weddingId))
  const diets = new Map(rows.map(g => [g.guestId, g.diet]))
  return (guestId: string) => diets.get(guestId)
}

export function assertSeatingCapacity(
  members: readonly Pick<PartyMember, 'guestId' | 'seatType'>[],
  capacity: number,
  dietOf: (guestId: string) => string | undefined,
) {
  if (seatingHeads(members, dietOf) > capacity)
    throw createError({ statusCode: 409, statusMessage: '桌次已滿，無法再安排座位；操作後計席人數超過容量（全素桌素食須計席），請先調整座位' })
}
