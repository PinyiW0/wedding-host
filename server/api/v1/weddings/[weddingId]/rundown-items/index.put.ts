import type { H3Event } from 'h3'
import type { RundownTableSavedEvent, SaveRundownTableBody } from '../../../../../../app/types/api/rundown'
import type { MockRundownItem } from '../../../../../mock/data/rundown'

import { mockRundownItems, mockRundownRoles } from '../../../../../mock/data/rundown'

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

  // roleTasks 過濾掉該婚禮不存在的 roleId
  const validRoleIds = new Set(
    mockRundownRoles.filter(r => r.weddingId === weddingId).map(r => r.roleId),
  )

  const items: MockRundownItem[] = rows.map(row => ({
    rundownItemId: row.rundownItemId ?? `rundownitem-${crypto.randomUUID().slice(0, 8)}`,
    weddingId,
    time: row.time || null,
    durationMinutes: row.durationMinutes ?? 0,
    title: row.title,
    location: row.location ?? null,
    supplies: row.supplies ?? null,
    note: row.note ?? null,
    roleTasks: (row.roleTasks ?? []).filter(rt => validRoleIds.has(rt.roleId)),
  }))

  // 就地取代該婚禮全部 items（splice 舊列、push 新列，保持陣列參照——reset 機制依賴參照不變）
  for (let i = mockRundownItems.length - 1; i >= 0; i--) {
    if (mockRundownItems[i]!.weddingId === weddingId)
      mockRundownItems.splice(i, 1)
  }
  mockRundownItems.push(...items)

  return { weddingId, itemCount: items.length, items }
})
