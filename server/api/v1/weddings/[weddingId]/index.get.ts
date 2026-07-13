import type { H3Event } from 'h3'
import type { WeddingDetail } from '../../../../../app/types/api/weddings'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { weddings } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<WeddingDetail> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const [wedding] = await useDb().select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  // 新人僅能存取自己擁有的婚禮
  assertWeddingAccess(getRequestUser(event), wedding.ownerId)
  // 匿名（公開頁簽名）不需內部欄位（issue #70 / L1）：剔除 ownerId（新人帳號主鍵）與軟刪除狀態
  const isAuthenticated = !!event.context.authUser
  return {
    weddingId: wedding.weddingId,
    title: wedding.title,
    venue: wedding.venue,
    address: wedding.address,
    date: wedding.date,
    groomName: wedding.groomName ?? null,
    brideName: wedding.brideName ?? null,
    mapLink: wedding.mapLink,
    parkingInfo: wedding.parkingInfo,
    transportInfo: wedding.transportInfo,
    transportImageUrls: wedding.transportImageUrls ?? [],
    ownerId: isAuthenticated ? (wedding.ownerId ?? null) : null,
    deletedAt: isAuthenticated ? wedding.deletedAt : null,
  }
})
