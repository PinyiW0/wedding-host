// 謝卡 LINE 訊息組裝：群發（multicast）與單獨重發（push）共用同一份內容
import type { thankYouTemplates } from '../db/schema'
import type { LineMessage } from './line'

type ThankYouTemplateRow = typeof thankYouTemplates.$inferSelect

// 訊息內容＝謝卡範本內文（未設範本時用預設感謝詞）；範本圖片需公開 https 才能附上
export function buildThankYouLineMessages(template: ThankYouTemplateRow | undefined): LineMessage[] {
  const text = [
    template?.greeting,
    template?.templateContent,
    [template?.signature, template?.signatureDate].filter(Boolean).join(' '),
  ].map(part => part?.trim()).filter(Boolean).join('\n\n') || '感謝您蒞臨我們的婚禮！'
  const imageUrl = template?.templateImageUrl?.startsWith('https://') ? template.templateImageUrl : null
  return [
    { type: 'text', text },
    ...(imageUrl ? [{ type: 'image' as const, originalContentUrl: imageUrl, previewImageUrl: imageUrl }] : []),
  ]
}
