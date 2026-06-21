// 謝卡與感謝訊息：範本設定 / 個別客製 / 群發 / 替代感謝

export interface SetThankYouTemplateBody {
  templateContent: string
  templateImageUrl?: string
}

export interface ThankYouTemplateSetEvent {
  weddingId: string
  templateContent: string
  templateImageUrl: string | null
}

export interface CustomizeThankYouCardBody {
  guestId: string
  customContent: string
}

export interface ThankYouCardCustomizedEvent {
  weddingId: string
  guestId: string
  customContent: string
}

// 讀回該婚禮已設定的謝卡範本（尚未設定回 null）
export interface ThankYouTemplateDetail {
  weddingId: string
  templateContent: string
  templateImageUrl: string | null
}

// 讀回該婚禮的個別客製謝卡清單
export interface ThankYouCustomizationListItem {
  weddingId: string
  guestId: string
  customContent: string
}

export interface ThankYouBatchSentEvent {
  weddingId: string
  recipientCount: number
}

export interface SendThankYouFallbackBody {
  guestId: string
  channel: 'email' | 'link'
}

export interface ThankYouFallbackSentEvent {
  weddingId: string
  guestId: string
  channel: 'email' | 'link'
}
