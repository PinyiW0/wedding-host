import type { H3Event } from 'h3'

import { useDb } from '../../db'
import { guests, projectionSettings } from '../../db/schema'

// 測試專用：在種子資料之上補到正式站規模（issue #224）——
// 120 位賓客、其中 60 位帶約 30KB 的手繪花圖，投影設定帶一張約 300KB 的照片與 5 朵自訂花。
// 種子資料沒有大欄位，輪詢端點拖出多少資料在種子規模下看不出來。
const WEDDING_ID = 'wedding-001'
const GUEST_COUNT = 120
const FLOWER_COUNT = 60
const FLOWER_BYTES = 30_000
const PHOTO_BYTES = 300_000
const CUSTOM_FLOWER_COUNT = 5

function dataUrl(bytes: number): string {
  return `data:image/png;base64,${'A'.repeat(bytes)}`
}

export default defineEventHandler(async (_event: H3Event) => {
  const db = useDb()
  await db.insert(guests).values(Array.from({ length: GUEST_COUNT }, (_, i) => ({
    guestId: `scale-guest-${String(i + 1).padStart(3, '0')}`,
    weddingId: WEDDING_ID,
    name: `規模賓客${String(i + 1).padStart(3, '0')}`,
    side: i % 2 === 0 ? 'groom' as const : 'bride' as const,
    diet: 'meat' as const,
    contact: `0900-000-${String(i + 1).padStart(3, '0')}`,
    childChairCount: 0,
    invitationSent: true,
    partySize: 1,
    flowerDrawing: i < FLOWER_COUNT ? dataUrl(FLOWER_BYTES) : null,
  }))).onConflictDoNothing()

  const settings = {
    mediaType: 'photo' as const,
    photoDataUrl: dataUrl(PHOTO_BYTES),
    videoUrl: null,
    customFlowers: Array.from<string>({ length: CUSTOM_FLOWER_COUNT }).fill(dataUrl(FLOWER_BYTES)),
  }
  await db.insert(projectionSettings).values({ weddingId: WEDDING_ID, ...settings }).onConflictDoUpdate({ target: projectionSettings.weddingId, set: settings })

  return { ok: true, guests: GUEST_COUNT, flowers: FLOWER_COUNT }
})
