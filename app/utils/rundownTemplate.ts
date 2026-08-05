// 宴客段範本（8 段）：前端帶入草稿用（不再走後端 apply-template）。
// 帶入僅產生草稿列，需再按「儲存」以 SaveRundownTable 整表 PUT。
// 時間推算：第一段＝startTime，第 n 段＝前段起始＋前段時長（18:00 起算 → 送客・合照 21:05）。
// roleTaskByName 以「角色名稱」對應帶入當下現存角色（改名/已刪則略過）；'all' = 全部角色（task 空字串＝參與但無個別事項）。

import type { RundownRoleListItem, SaveRundownTableBody } from '~/types/api/rundown'

export interface RundownTemplateSegment {
  title: string
  durationMinutes: number
  location: string
  supplies: string | null
  roleTaskByName: Record<string, string> | 'all'
  // 帶入後預設對賓客公開：賓客在場的段落才給，籌備與換裝段留給工作人員
  guestVisible: boolean
}

export const RUNDOWN_TEMPLATE: RundownTemplateSegment[] = [
  { title: '彩排・設備確認', durationMinutes: 15, location: '宴會廳', supplies: '音響、投影、麥克風', roleTaskByName: { 總場控: '流程走位、音控測試', 新秘: '定妝檢查' }, guestVisible: false },
  { title: '迎賓・收禮金', durationMinutes: 30, location: '宴會廳入口', supplies: '禮金簿、簽名綢、喜糖', roleTaskByName: { 接待: '簽到、禮金點收' }, guestVisible: true },
  { title: '主持開場・一進', durationMinutes: 25, location: '宴會廳', supplies: '進場音樂、手捧花', roleTaskByName: { 總場控: 'cue 流程、音控', 平面攝影師: '進場側拍' }, guestVisible: true },
  { title: '開桌上菜', durationMinutes: 10, location: '宴會廳', supplies: null, roleTaskByName: { 總場控: '與內場確認上菜' }, guestVisible: true },
  { title: '退場換裝', durationMinutes: 30, location: '新娘房', supplies: '第二套禮服', roleTaskByName: { 新秘: '第二套禮服妝髮' }, guestVisible: false },
  { title: '二進・遊戲・敬酒', durationMinutes: 45, location: '宴會廳', supplies: '遊戲道具、酒水', roleTaskByName: { 總場控: '遊戲主持、敬酒引導', 平面攝影師: '逐桌合照' }, guestVisible: true },
  { title: '二退換裝備送客', durationMinutes: 30, location: '新娘房', supplies: '送客禮服', roleTaskByName: { 新秘: '送客造型' }, guestVisible: false },
  { title: '送客・合照', durationMinutes: 30, location: '宴會廳門口', supplies: '送客禮', roleTaskByName: 'all', guestVisible: true },
]

// HH:MM 加 minutes 後回 HH:MM（跨日取 24 小時制餘數）
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = (h! * 60 + m! + minutes) % (24 * 60)
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/** 依 startTime 產生範本草稿列（無 rundownItemId，儲存時由後端配發） */
export function buildTemplateRows(
  startTime: string,
  roles: RundownRoleListItem[],
): SaveRundownTableBody['items'] {
  let time = startTime
  return RUNDOWN_TEMPLATE.map((seg) => {
    const roleTasks = seg.roleTaskByName === 'all'
      ? roles.map(r => ({ roleId: r.roleId, task: '' }))
      : roles
          .filter(r => typeof seg.roleTaskByName === 'object' && r.name in seg.roleTaskByName)
          .map(r => ({ roleId: r.roleId, task: (seg.roleTaskByName as Record<string, string>)[r.name]! }))

    const row: SaveRundownTableBody['items'][number] = {
      time,
      durationMinutes: seg.durationMinutes,
      title: seg.title,
      location: seg.location,
      roleTasks,
      guestVisible: seg.guestVisible,
    }
    if (seg.supplies)
      row.supplies = seg.supplies

    time = addMinutes(time, seg.durationMinutes)
    return row
  })
}

/** modal 預覽用：各段起訖時間（訖＝起＋時長） */
export function previewTemplateTimes(startTime: string): { title: string, start: string, end: string }[] {
  let start = startTime
  return RUNDOWN_TEMPLATE.map((seg) => {
    const end = addMinutes(start, seg.durationMinutes)
    const entry = { title: seg.title, start, end }
    start = end
    return entry
  })
}
