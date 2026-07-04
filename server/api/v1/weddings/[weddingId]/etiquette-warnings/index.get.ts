import type { H3Event } from 'h3'
import type { EtiquetteWarningListItem } from '../../../../../../app/types/api/seating'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { etiquetteWarnings } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<EtiquetteWarningListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(etiquetteWarnings).where(eq(etiquetteWarnings.weddingId, weddingId)).orderBy(asc(etiquetteWarnings.seq))
  return rows.map(w => ({
    warningId: w.warningId,
    warningType: w.warningType,
    message: w.message,
    dismissed: w.dismissed,
  }))
})
