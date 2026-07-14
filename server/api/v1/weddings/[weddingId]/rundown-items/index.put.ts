import type { H3Event } from 'h3'
import type { RundownItemListItem, RundownTableSavedEvent, SaveRundownTableBody } from '../../../../../../app/types/api/rundown'

import { and, eq, notInArray, sql } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { rundownItems, rundownRoles } from '../../../../../db/schema'

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/

// 整表取代：既有列帶 rundownItemId 沿用、新列後端配發、未帶回的既有列＝刪除
export default defineEventHandler(async (event: H3Event): Promise<RundownTableSavedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SaveRundownTableBody>(event)
  const rows = body?.items ?? []

  // 逐列驗證：title 必填；time 有填才驗格式（空/null 允許＝未定時段）
  for (const row of rows) {
    if (!row.title)
      throw createError({ statusCode: 400, statusMessage: '請輸入主要事項' })
    if (row.time != null && row.time !== '' && !TIME_RE.test(row.time))
      throw createError({ statusCode: 400, statusMessage: '時間格式錯誤' })
  }

  const db = useDb()

  // roleTasks 過濾掉該婚禮不存在的 roleId
  const roles = await db.select().from(rundownRoles).where(eq(rundownRoles.weddingId, weddingId))
  const validRoleIds = new Set(roles.map(r => r.roleId))

  const items: RundownItemListItem[] = rows.map(row => ({
    rundownItemId: row.rundownItemId ?? `rundownitem-${crypto.randomUUID().slice(0, 8)}`,
    weddingId,
    time: row.time || null,
    durationMinutes: row.durationMinutes ?? 0,
    title: row.title,
    location: row.location ?? null,
    supplies: row.supplies ?? null,
    note: row.note ?? null,
    roleTasks: (row.roleTasks ?? []).filter(rt => validRoleIds.has(rt.roleId)),
    // 凍結測試以 raw PUT 不帶此欄呼叫，必須有預設值
    highlight: row.highlight ?? false,
  }))

  // 整批取代：改用「upsert（by rundownItemId）先行 + 刪除不在新集合者」取代 delete-all+insert，
  // 任一步失敗都不會讓流程表瞬間清空；顯示序由 GET 依 time 排序、不依賴 seq（issue #71）
  if (items.length) {
    await db.insert(rundownItems).values(items).onConflictDoUpdate({
      target: rundownItems.rundownItemId,
      set: {
        time: sql`excluded.time`,
        durationMinutes: sql`excluded.duration_minutes`,
        title: sql`excluded.title`,
        location: sql`excluded.location`,
        supplies: sql`excluded.supplies`,
        note: sql`excluded.note`,
        roleTasks: sql`excluded.role_tasks`,
        highlight: sql`excluded.highlight`,
      },
    })
    await db.delete(rundownItems).where(and(
      eq(rundownItems.weddingId, weddingId),
      notInArray(rundownItems.rundownItemId, items.map(i => i.rundownItemId)),
    ))
  }
  else {
    await db.delete(rundownItems).where(eq(rundownItems.weddingId, weddingId))
  }

  return { weddingId, itemCount: items.length, items }
})
