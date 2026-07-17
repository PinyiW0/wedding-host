import type { H3Event } from 'h3'
import type { GuestUpdatedEvent, UpdateGuestBody } from '../../../../../../../app/types/api/guests'

import { and, eq, getTableColumns, inArray } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guestCategories, guests, seatingTables, seats } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GuestUpdatedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<UpdateGuestBody>(event)

  const db = useDb()
  // leftJoin 取分類名稱：一次查詢同時解決回傳的 category（不用再查一次字典）
  const [existing] = await db
    .select({ ...getTableColumns(guests), categoryName: guestCategories.name })
    .from(guests)
    .leftJoin(guestCategories, eq(guests.categoryId, guestCategories.categoryId))
    .where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  const { categoryName: existingCategoryName, ...existingGuest } = existing

  // 數字欄與 enum 欄驗證（issue #70 / M4）：patch 的 partySize 會進座位重算，NaN 會靜默污染
  if (body.partySize !== undefined)
    assertPositiveInt(body.partySize, '總人數', 999)
  if (body.childChairCount !== undefined)
    assertPositiveInt(body.childChairCount, '兒童椅數', 99)
  if (body.shuttleCount !== undefined && body.shuttleCount !== null)
    assertPositiveInt(body.shuttleCount, '接駁人數', 999)
  if (body.side !== undefined)
    assertEnum(body.side, ['groom', 'bride'], '男女方')
  if (body.diet !== undefined)
    assertEnum(body.diet, ['meat', 'vegetarian'], '飲食偏好')

  const patch: Partial<typeof guests.$inferInsert> = {}
  if (body.name !== undefined)
    patch.name = body.name
  if (body.side !== undefined)
    patch.side = body.side
  if (body.diet !== undefined)
    patch.diet = body.diet
  // 分類 resolve 成 categoryId（在 404 檢查之後才建分類，避免對不存在的賓客留下副作用）；空白 → null
  let categoryName = existingCategoryName ?? ''
  if (body.category !== undefined) {
    categoryName = body.category.trim()
    patch.categoryId = await resolveCategoryId(db, weddingId, categoryName)
  }
  if (body.contact !== undefined)
    patch.contact = body.contact
  if (body.partySize !== undefined)
    patch.partySize = body.partySize
  if (body.childChairCount !== undefined)
    patch.childChairCount = body.childChairCount
  if (body.notes !== undefined)
    patch.notes = body.notes
  // 管理員修正的 RSVP 回覆欄位（接駁／喜帖）
  if (body.needsShuttle !== undefined)
    patch.needsShuttle = body.needsShuttle
  if (body.shuttleCount !== undefined)
    patch.shuttleCount = body.shuttleCount
  if (body.invitationPreference !== undefined)
    patch.invitationPreference = body.invitationPreference
  if (body.mailingAddress !== undefined)
    patch.mailingAddress = body.mailingAddress

  // 空 patch 時不打 update（drizzle set({}) 會擲錯），直接回現值
  const [guest] = Object.keys(patch).length
    ? await db.update(guests).set(patch).where(eq(guests.guestId, guestId)).returning()
    : [existingGuest]

  // 同行人數／兒童椅數變動時同步席位：原桌容得下→就地補齊或釋出；容不下→整組退回待排
  const partyChanged = guest!.partySize !== existingGuest.partySize
    || guest!.childChairCount !== existingGuest.childChairCount
  if (partyChanged) {
    const partySeats = await db.select().from(seats).where(eq(seats.guestId, guestId))
    if (partySeats.length) {
      // 同組席位可能因單席移動跨桌，以席位最多的桌為主桌位
      const countByTable = new Map<string, number>()
      for (const s of partySeats)
        countByTable.set(s.tableId, (countByTable.get(s.tableId) ?? 0) + 1)
      const homeTableId = [...countByTable.entries()].sort((a, b) => b[1] - a[1])[0]![0]

      const newNormal = Math.max(0, guest!.partySize - guest!.childChairCount)
      const newChild = guest!.childChairCount
      const curNormal = partySeats.filter(s => s.seatType === 'normal').sort((a, b) => a.partyIndex - b.partyIndex)
      const curChild = partySeats.filter(s => s.seatType === 'childChair').sort((a, b) => a.partyIndex - b.partyIndex)

      const [homeTable] = await db.select().from(seatingTables).where(eq(seatingTables.tableId, homeTableId))
      const homeSeats = await db.select().from(seats).where(eq(seats.tableId, homeTableId))
      const homeNormalCount = homeSeats.filter(s => s.seatType === 'normal').length
      const normalDelta = newNormal - curNormal.length

      if (!homeTable || (normalDelta > 0 && homeNormalCount + normalDelta > homeTable.capacity)) {
        // 原桌容不下 → 整組退回待排
        await db.delete(seats).where(eq(seats.guestId, guestId))
      }
      else {
        // 減少的席位釋出（partyIndex 高者先移除，標籤不跳號）
        const toRemove = [...curNormal.slice(newNormal), ...curChild.slice(newChild)]
        if (toRemove.length) {
          await db.delete(seats).where(inArray(seats.seq, toRemove.map(s => s.seq)))
        }
        // 增加的席位補到主桌空號
        const occupied = new Set(homeSeats.map(s => s.seatNumber))
        for (const s of toRemove) {
          if (s.tableId === homeTableId)
            occupied.delete(s.seatNumber)
        }
        let seatNo = 1
        const nextFreeSeatNo = () => {
          while (occupied.has(seatNo))
            seatNo++
          occupied.add(seatNo)
          return seatNo
        }
        const inserts: typeof seats.$inferInsert[] = []
        for (let i = curNormal.length + 1; i <= newNormal; i++) {
          inserts.push({ tableId: homeTableId, guestId, seatNumber: nextFreeSeatNo(), seatType: 'normal', partyIndex: i })
        }
        for (let i = curChild.length + 1; i <= newChild; i++) {
          inserts.push({ tableId: homeTableId, guestId, seatNumber: nextFreeSeatNo(), seatType: 'childChair', partyIndex: i })
        }
        if (inserts.length) {
          await db.insert(seats).values(inserts)
        }
      }
    }
  }

  return {
    guestId: guest!.guestId,
    weddingId: guest!.weddingId,
    name: guest!.name,
    side: guest!.side,
    diet: guest!.diet,
    category: categoryName,
    contact: guest!.contact,
    partySize: guest!.partySize,
    childChairCount: guest!.childChairCount,
    notes: guest!.notes,
  }
})
