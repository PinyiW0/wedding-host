// 謝卡與感謝訊息 mock 資料：範本 / 個別客製

export interface MockThankYouTemplate {
  weddingId: string
  templateContent: string
  templateImageUrl: string | null
}

export interface MockThankYouCustomization {
  weddingId: string
  guestId: string
  customContent: string
}

export const mockThankYouTemplates: MockThankYouTemplate[] = []

export const mockThankYouCustomizations: MockThankYouCustomization[] = []
