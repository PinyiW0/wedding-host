import type { H3Event } from 'h3'
import type { VenueAnalysisResult } from '../../../../../../app/types/api/seating'
import { Buffer } from 'node:buffer'

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { useDb } from '../../../../../db'
import { venueLayouts, weddings } from '../../../../../db/schema'

// Claude 回傳的分析結果（相對比例 0~1；structured output 保證形狀）
const analysisSchema = z.object({
  // 舞台左上角與寬高；圖中辨識不出舞台則為 null
  stage: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).nullable(),
  // 每張賓客桌的圓心
  tables: z.array(z.object({ x: z.number(), y: z.number() })),
})

const PROMPT = `這是一張婚宴場地的平面示意圖。請找出圖中所有「賓客桌」（通常畫成圓形或方形的桌子符號）與「舞台／主台」區域。

回傳規則：
- 所有座標一律使用相對比例 0~1（x 向右、y 向下，相對於整張圖）
- 每張桌子回傳其中心點座標
- 舞台回傳左上角座標與寬高比例；圖中辨識不出舞台就回 null
- 只回傳有把握是桌子的物件；裝飾、文字、圖例不要算
- 桌子數量以圖面為準，不要腦補圖中沒有的桌子`

const DATA_URL_RE = /^data:(image\/(?:png|jpeg));base64,(.+)$/

// dataURL 或遠端 URL（R2）→ base64 與 media type
async function loadImage(url: string): Promise<{ mediaType: 'image/png' | 'image/jpeg', data: string }> {
  if (url.startsWith('data:')) {
    const match = url.match(DATA_URL_RE)
    if (!match)
      throw createError({ statusCode: 422, statusMessage: '參考圖格式無法解析，請重新上傳' })
    return { mediaType: match[1] as 'image/png' | 'image/jpeg', data: match[2]! }
  }
  const res = await fetch(url)
  if (!res.ok)
    throw createError({ statusCode: 502, statusMessage: '參考圖下載失敗，請稍後再試' })
  const contentType = res.headers.get('content-type') ?? ''
  const mediaType = contentType.includes('jpeg') ? 'image/jpeg' as const : 'image/png' as const
  const data = Buffer.from(await res.arrayBuffer()).toString('base64')
  return { mediaType, data }
}

export default defineEventHandler(async (event: H3Event): Promise<VenueAnalysisResult> => {
  const apiKey = useRuntimeConfig().anthropicApiKey
  if (!apiKey) {
    throw createError({ statusCode: 501, statusMessage: '尚未設定 AI 分析功能（NUXT_ANTHROPIC_API_KEY）' })
  }

  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  const [layout] = await db.select().from(venueLayouts).where(eq(venueLayouts.weddingId, weddingId))
  if (!layout?.referenceImageUrl) {
    throw createError({ statusCode: 400, statusMessage: '請先上傳場地參考圖' })
  }

  const image = await loadImage(layout.referenceImageUrl)
  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.parse({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(analysisSchema) },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      throw createError({ statusCode: 502, statusMessage: 'AI 無法辨識這張參考圖，請換一張更清晰的平面圖' })
    }
    return response.parsed_output
  }
  catch (error: any) {
    // h3 錯誤（上面丟的）原樣透傳；Anthropic API 錯誤收斂成可讀訊息
    if (error?.statusCode)
      throw error
    throw createError({ statusCode: 502, statusMessage: 'AI 分析失敗，請稍後再試' })
  }
})
