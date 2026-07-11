import type { BlessingStatus, BlessingWallStatus } from '../../app/types/api/blessings'
import type { GiftCategory } from '../../app/types/api/gifts'
import type { GuestSource, GuestStatus } from '../../app/types/api/guests'
import type { ProjectionMediaType } from '../../app/types/api/projection'
import type { AttendingStatus, InvitationPreference } from '../../app/types/api/rsvp'
import type { RsvpQuestion, RsvpTheme } from '../../app/types/api/rsvp-config'
import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'

// Drizzle schema：24 張表，一一對齊 server/mock/data 的 store 形狀（欄位名即 API 合約）
// 設計原則（務實派 CRUD，見 issue #3 / #4）：
// - 文字 PK 沿用 mock id 格式（guest-001…），由 handler 產生，無自增序列
// - 時間欄位一律存 ISO 字串（text），與 API JSON 回應完全一致，避免 Date 序列化差異
// - 不宣告 FK 約束：級聯／孤兒語意由 handler 掌控（與 mock 行為一致），避免行為漂移
// - 巢狀結構走 jsonb；weddingId 為分片主軸，非 PK 者一律掛 index

export const users = pgTable('users', {
  seq: integer().generatedByDefaultAsIdentity(),
  userId: text().primaryKey(),
  username: text().notNull(),
  email: text().notNull(),
  passwordHash: text().notNull(),
  displayName: text().notNull(),
  role: text().notNull(),
  weddingId: text(),
  deletedAt: text(),
})

export const receptionAccounts = pgTable('reception_accounts', {
  seq: integer().generatedByDefaultAsIdentity(),
  accountId: text().primaryKey(),
  weddingId: text().notNull(),
  username: text().notNull(),
  passwordHash: text().notNull(),
}, t => [index().on(t.weddingId)])

export const weddings = pgTable('weddings', {
  seq: integer().generatedByDefaultAsIdentity(),
  weddingId: text().primaryKey(),
  title: text().notNull(),
  venue: text().notNull(),
  address: text().notNull(),
  date: text().notNull(),
  groomName: text(),
  brideName: text(),
  mapLink: text(),
  parkingInfo: text(),
  transportInfo: text(),
  transportImageUrls: jsonb().$type<string[]>(),
  ownerId: text(),
  deletedAt: text(),
})

export const guests = pgTable('guests', {
  seq: integer().generatedByDefaultAsIdentity(),
  guestId: text().primaryKey(),
  weddingId: text().notNull(),
  name: text().notNull(),
  side: text().$type<'groom' | 'bride'>().notNull(),
  diet: text().$type<'meat' | 'vegetarian'>().notNull(),
  category: text().notNull(),
  contact: text().notNull(),
  childChairCount: integer().notNull(),
  notes: text(),
  lineUserId: text(),
  rsvpAttending: text().$type<AttendingStatus>(),
  checkedInAt: text(),
  giftAmount: integer(),
  cakeBoxDistributedTypeId: text(),
  invitationSent: boolean().notNull(),
  partySize: integer().notNull(),
  tableName: text(),
  deletedAt: text(),
  invitationPreference: text().$type<InvitationPreference>(),
  mailingAddress: text(),
  blessing: text(),
  flowerDrawing: text(),
  needsShuttle: boolean(),
  shuttleCount: integer(),
  customAnswers: jsonb().$type<Record<string, string | string[]>>(),
  status: text().$type<GuestStatus>(),
  source: text().$type<GuestSource>(),
}, t => [index().on(t.weddingId)])

export const guestCategories = pgTable('guest_categories', {
  seq: integer().generatedByDefaultAsIdentity(),
  weddingId: text().notNull(),
  name: text().notNull(),
}, t => [primaryKey({ columns: [t.weddingId, t.name] })])

export const blessings = pgTable('blessings', {
  seq: integer().generatedByDefaultAsIdentity(),
  blessingId: text().primaryKey(),
  weddingId: text().notNull(),
  // 共用 QR 提交無賓客實體：guestId 為 null、姓名存 guestName
  guestId: text(),
  guestName: text(),
  message: text().notNull(),
  photoUrl: text(),
  status: text().$type<BlessingStatus>().notNull(),
  rejectReason: text(),
  wallStatus: text().$type<BlessingWallStatus>(),
}, t => [index().on(t.weddingId)])

export const giftItems = pgTable('gift_items', {
  seq: integer().generatedByDefaultAsIdentity(),
  giftItemId: text().primaryKey(),
  weddingId: text().notNull(),
  category: text().$type<GiftCategory>().notNull(),
  description: text().notNull(),
  imageUrl: text(),
  unitPrice: integer().notNull(),
  quantity: integer().notNull(),
  purchaseUrl: text(),
  distributionTime: text(),
  shippingFee1: integer().notNull(),
  shippingFee2: integer().notNull(),
  otherFee: integer().notNull(),
  note: text(),
}, t => [index().on(t.weddingId)])

export const cakeBoxTypes = pgTable('cake_box_types', {
  seq: integer().generatedByDefaultAsIdentity(),
  cakeBoxTypeId: text().primaryKey(),
  weddingId: text().notNull(),
  name: text().notNull(),
  description: text(),
  isDefault: boolean().notNull(),
  imageUrl: text(),
  price: integer(),
}, t => [index().on(t.weddingId)])

// 指派／排除／座位等連結表不設 PK：mock 陣列本無唯一約束，唯一性語意由 handler 維護
export const cakeBoxAssignments = pgTable('cake_box_assignments', {
  seq: integer().generatedByDefaultAsIdentity(),
  cakeBoxTypeId: text().notNull(),
  guestId: text().notNull(),
  assignmentRule: text().notNull(),
}, t => [index().on(t.guestId)])

export const cakeBoxExclusions = pgTable('cake_box_exclusions', {
  seq: integer().generatedByDefaultAsIdentity(),
  weddingId: text().notNull(),
  guestId: text().notNull(),
}, t => [index().on(t.weddingId)])

export const cakeBoxExtraOrders = pgTable('cake_box_extra_orders', {
  seq: integer().generatedByDefaultAsIdentity(),
  extraOrderId: text().primaryKey(),
  weddingId: text().notNull(),
  cakeBoxTypeId: text().notNull(),
  quantity: integer().notNull(),
  recipientName: text(),
  recipientContact: text(),
  note: text(),
}, t => [index().on(t.weddingId)])

export const seatingTables = pgTable('seating_tables', {
  seq: integer().generatedByDefaultAsIdentity(),
  tableId: text().primaryKey(),
  weddingId: text().notNull(),
  tableName: text().notNull(),
  capacity: integer().notNull(),
  positionX: doublePrecision().notNull(),
  positionY: doublePrecision().notNull(),
}, t => [index().on(t.weddingId)])

export const seats = pgTable('seats', {
  seq: integer().generatedByDefaultAsIdentity(),
  tableId: text().notNull(),
  guestId: text().notNull(),
  seatNumber: integer().notNull(),
  seatType: text().$type<'normal' | 'childChair'>().notNull(),
  partyIndex: integer().notNull(),
}, t => [index().on(t.tableId), index().on(t.guestId)])

export const venueLayouts = pgTable('venue_layouts', {
  weddingId: text().primaryKey(),
  stageWidth: doublePrecision().notNull(),
  stageHeight: doublePrecision().notNull(),
  stagePositionX: doublePrecision().notNull(),
  stagePositionY: doublePrecision().notNull(),
  // 場地參考圖（R2 公開 URL 或 dataURL fallback）；未上傳為 null
  referenceImageUrl: text(),
})

export const venueMarkers = pgTable('venue_markers', {
  seq: integer().generatedByDefaultAsIdentity(),
  markerId: text().primaryKey(),
  weddingId: text().notNull(),
  label: text().notNull(),
  positionX: doublePrecision().notNull(),
  positionY: doublePrecision().notNull(),
  width: doublePrecision().notNull(),
  height: doublePrecision().notNull(),
}, t => [index().on(t.weddingId)])

export const etiquetteSettings = pgTable('etiquette_settings', {
  weddingId: text().primaryKey(),
  elderNearMain: boolean().notNull(),
  mainTableFull: boolean().notNull(),
  sameCategoryTogether: boolean().notNull(),
})

export const etiquetteWarnings = pgTable('etiquette_warnings', {
  seq: integer().generatedByDefaultAsIdentity(),
  warningId: text().primaryKey(),
  weddingId: text().notNull(),
  warningType: text().notNull(),
  message: text().notNull(),
  dismissed: boolean().notNull(),
}, t => [index().on(t.weddingId)])

export const rundownRoles = pgTable('rundown_roles', {
  seq: integer().generatedByDefaultAsIdentity(),
  roleId: text().primaryKey(),
  weddingId: text().notNull(),
  name: text().notNull(),
}, t => [index().on(t.weddingId)])

export const rundownItems = pgTable('rundown_items', {
  seq: integer().generatedByDefaultAsIdentity(),
  rundownItemId: text().primaryKey(),
  weddingId: text().notNull(),
  time: text(),
  durationMinutes: integer().notNull(),
  title: text().notNull(),
  location: text(),
  supplies: text(),
  note: text(),
  roleTasks: jsonb().$type<{ roleId: string, task: string }[]>().notNull(),
  highlight: boolean().notNull(),
}, t => [index().on(t.weddingId)])

export const rsvpFormConfigs = pgTable('rsvp_form_configs', {
  weddingId: text().primaryKey(),
  theme: text().$type<RsvpTheme>().notNull(),
  banner: text(),
  questions: jsonb().$type<RsvpQuestion[]>().notNull(),
})

export const lineOas = pgTable('line_oas', {
  weddingId: text().primaryKey(),
  oaName: text().notNull(),
  channelId: text().notNull(),
  addFriendUrl: text(),
})

export const thankYouTemplates = pgTable('thank_you_templates', {
  weddingId: text().primaryKey(),
  templateContent: text().notNull(),
  templateImageUrl: text(),
  greeting: text(),
  signature: text(),
  signatureDate: text(),
})

export const thankYouCustomizations = pgTable('thank_you_customizations', {
  seq: integer().generatedByDefaultAsIdentity(),
  weddingId: text().notNull(),
  guestId: text().notNull(),
  customContent: text().notNull(),
}, t => [primaryKey({ columns: [t.weddingId, t.guestId] })])

// 謝卡群發紀錄（M4 額度追蹤）：僅真發送落檔，成敗人數與操作者可回溯
export const thankYouBatchSends = pgTable('thank_you_batch_sends', {
  seq: integer().generatedByDefaultAsIdentity(),
  weddingId: text().notNull(),
  successCount: integer().notNull(),
  failedCount: integer().notNull(),
  sentAt: text().notNull(),
  sentBy: text().notNull(),
}, t => [index().on(t.weddingId)])

export const projectionSettings = pgTable('projection_settings', {
  weddingId: text().primaryKey(),
  mediaType: text().$type<ProjectionMediaType>().notNull(),
  photoDataUrl: text(),
  videoUrl: text(),
  customFlowers: jsonb().$type<string[]>().notNull(),
})
