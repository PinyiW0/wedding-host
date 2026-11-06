import type { H3Event } from 'h3'
import type { ReorderRundownRolesBody, RundownRoleListItem } from '../../../../../../app/types/api/rundown'

import { and, asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { rundownRoles } from '../../../../../db/schema'

// 調整角色欄左右順序（issue #207）：body 帶這場婚禮全部角色的 roleId，陣列順序即新順序。
// 必須剛好是全部角色、不多不少：別人剛新增或移除角色時，舊畫面送來的清單會對不上，回 400 請對方重新整理
export default defineEventHandler(async (event: H3Event): Promise<RundownRoleListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ReorderRundownRolesBody>(event)
  const roleIds = body?.roleIds
  if (!Array.isArray(roleIds) || roleIds.some(id => typeof id !== 'string') || new Set(roleIds).size !== roleIds.length)
    throw createError({ statusCode: 400, statusMessage: '角色順序格式錯誤' })

  const db = useDb()
  const rows = await db.select({ roleId: rundownRoles.roleId }).from(rundownRoles).where(eq(rundownRoles.weddingId, weddingId))
  const existing = new Set(rows.map(r => r.roleId))
  if (roleIds.length !== existing.size || roleIds.some(id => !existing.has(id)))
    throw createError({ statusCode: 400, statusMessage: '角色清單已變更，請重新整理後再排序' })

  // neon-http 沒有 transaction：驗證都在寫入之前做完；逐筆更新，同一份清單重送結果相同
  await Promise.all(roleIds.map((roleId, position) =>
    db.update(rundownRoles).set({ position }).where(and(eq(rundownRoles.weddingId, weddingId), eq(rundownRoles.roleId, roleId))),
  ))

  const sorted = await db.select().from(rundownRoles).where(eq(rundownRoles.weddingId, weddingId)).orderBy(asc(rundownRoles.position), asc(rundownRoles.seq))
  return sorted.map(r => ({ roleId: r.roleId, weddingId: r.weddingId, name: r.name }))
})
