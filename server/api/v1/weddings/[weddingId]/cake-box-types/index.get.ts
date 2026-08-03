import type { H3Event } from 'h3'
import type { CakeBoxTypeListItem } from '../../../../../../app/types/api/cakebox'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxTypes } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxTypeListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(cakeBoxTypes).where(eq(cakeBoxTypes.weddingId, weddingId)).orderBy(asc(cakeBoxTypes.seq))
  return rows.map(c => ({
    cakeBoxTypeId: c.cakeBoxTypeId,
    weddingId: c.weddingId,
    name: c.name,
    description: c.description,
    isDefault: c.isDefault,
    imageUrl: c.imageUrl,
    price: c.price,
    componentTypeIds: c.componentTypeIds ?? null,
    visibleToReception: c.visibleToReception,
  }))
})
