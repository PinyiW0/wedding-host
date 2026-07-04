import type { H3Event } from 'h3'
import type { DismissEtiquetteWarningBody, EtiquetteWarningDismissedEvent } from '../../../../../../../app/types/api/seating'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { etiquetteWarnings, weddings } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<EtiquetteWarningDismissedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const warningId = getRouterParam(event, 'warningId')
  const body = await readBody<DismissEtiquetteWarningBody>(event)

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const [warning] = warningId
    ? await db.select().from(etiquetteWarnings).where(eq(etiquetteWarnings.warningId, warningId))
    : []
  if (warning) {
    await db.update(etiquetteWarnings).set({ dismissed: true }).where(eq(etiquetteWarnings.warningId, warning.warningId))
  }

  setResponseStatus(event, 201)
  return { warningId: warningId ?? '', warningType: body?.warningType ?? warning?.warningType ?? '' }
})
