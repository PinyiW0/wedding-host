import type { SubmitRsvpBody } from '../../app/types/api/rsvp'

const ATTENDING = new Set(['attending', 'declined', 'absent'])
const DIET = new Set(['meat', 'vegetarian'])

// 公開／賓客 RSVP 表單的必填欄位驗證：擋非法出席狀態、飲食與負數／非整數人數。
// partySize 由 1 + plusOneCount + childChairCount 推導——未驗證會被非數字 body 污染成 NaN 落庫或 500。
export function assertValidRsvpInput(body: SubmitRsvpBody): void {
  if (!body || !ATTENDING.has(body.attending)) {
    throw createError({ statusCode: 400, statusMessage: '出席狀態不正確' })
  }
  if (!DIET.has(body.diet)) {
    throw createError({ statusCode: 400, statusMessage: '飲食偏好不正確' })
  }
  if (!Number.isInteger(body.plusOneCount) || body.plusOneCount < 0
    || !Number.isInteger(body.childChairCount) || body.childChairCount < 0) {
    throw createError({ statusCode: 400, statusMessage: '同行人數格式不正確' })
  }
}
