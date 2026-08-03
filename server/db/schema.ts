import type { BlessingStatus, BlessingWallStatus } from '../../app/types/api/blessings'
import type { GuestSource, GuestStatus } from '../../app/types/api/guests'
import type { ProjectionMediaType } from '../../app/types/api/projection'
import type { AttendingStatus, InvitationPreference } from '../../app/types/api/rsvp'
import type { RsvpQuestion, RsvpTheme } from '../../app/types/api/rsvp-config'
import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core'

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
  // (weddingId, username) 唯一：DB 層兜底併發建帳撞名（handler 的 check-then-insert 之外）（issue #71）
  // 複合索引最左前綴亦服務原本的 weddingId 查詢
}, t => [uniqueIndex().on(t.weddingId, t.username)])

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
  // 分類改存 id（原為名稱字串外鍵，issue #94）：nullable，空白分類存 null、不在字典造空列
  categoryId: text(),
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
}, t => [index().on(t.weddingId), index().on(t.categoryId)])

// 婚禮層級分類字典：id 為 PK、(weddingId, name) 唯一（同場不得同名，DB 兜底併發 find-or-create）。
// tier / isMainTable 為「語意欄位」——座位排序與主桌判定的唯一依據，不再由前端比對名稱字串
// （建立分類時以名稱推斷初值，見 server/utils/guest-category.ts）。tier：0 新人／1 家屬長輩／
// 2 主管貴賓摯友／3 一般（預設）。
export const guestCategories = pgTable('guest_categories', {
  seq: integer().generatedByDefaultAsIdentity(),
  categoryId: text().primaryKey(),
  weddingId: text().notNull(),
  name: text().notNull(),
  tier: integer().notNull().default(3),
  isMainTable: boolean().notNull().default(false),
}, t => [uniqueIndex().on(t.weddingId, t.name)])

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

// 婚禮小物類別字典（issue #124）：預設六類 seed、可自訂新增／改名／刪除。
// categoryId 婚禮內唯一即可（預設類沿用語意 slug：table…tea_ceremony，與既有 gift_items.category
// 存值相容、資料免搬移），跨婚禮可重複 → 複合 PK (weddingId, categoryId)；(weddingId, name) 唯一防同名
export const giftCategories = pgTable('gift_categories', {
  seq: integer().generatedByDefaultAsIdentity(),
  weddingId: text().notNull(),
  categoryId: text().notNull(),
  name: text().notNull(),
  sortOrder: integer().notNull(),
}, t => [primaryKey({ columns: [t.weddingId, t.categoryId] }), uniqueIndex().on(t.weddingId, t.name)])

export const giftItems = pgTable('gift_items', {
  seq: integer().generatedByDefaultAsIdentity(),
  giftItemId: text().primaryKey(),
  weddingId: text().notNull(),
  // 存 giftCategories.categoryId（無 FK 約束，孤兒防護由類別刪除的擋刪守門承擔）
  category: text().notNull(),
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
  // 組合款（issue #106）：內含單款 id 清單；null／空＝一般單款。僅可內含非組合款（單層，防巢狀）
  componentTypeIds: jsonb().$type<string[]>(),
  // 接待台可選（issue #138）：false＝只有新人知道的款式，接待端選款清單不列出。
  // 既有列由 DEFAULT true 回填——原本沒有這個概念的款式一律維持可選
  visibleToReception: boolean().notNull().default(true),
}, t => [index().on(t.weddingId)])

// 一位賓客只保留一筆喜餅指派：guestId 設 unique，讓指派改用單語句 upsert（ON CONFLICT）
// 取代原本 delete+insert 非原子替換，並在 DB 層兜底併發重複（issue #71）
export const cakeBoxAssignments = pgTable('cake_box_assignments', {
  seq: integer().generatedByDefaultAsIdentity(),
  cakeBoxTypeId: text().notNull(),
  guestId: text().notNull(),
  assignmentRule: text().notNull(),
}, t => [uniqueIndex().on(t.guestId)])

export const cakeBoxExclusions = pgTable('cake_box_exclusions', {
  seq: integer().generatedByDefaultAsIdentity(),
  weddingId: text().notNull(),
  guestId: text().notNull(),
  // (weddingId, guestId) 唯一：一位賓客一筆排除，讓寫入改用 onConflictDoNothing 冪等、DB 兜底重複（issue #71）
}, t => [uniqueIndex().on(t.weddingId, t.guestId)])

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
  // 參考圖對位結果（畫布位置 px 與縮放倍率），跨進出頁面保留
  refImageX: doublePrecision().notNull().default(0),
  refImageY: doublePrecision().notNull().default(0),
  refImageScale: doublePrecision().notNull().default(1),
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

export const rundownRoles = pgTable('rundown_roles', {
  seq: integer().generatedByDefaultAsIdentity(),
  roleId: text().primaryKey(),
  weddingId: text().notNull(),
  name: text().notNull(),
  // (weddingId, name) 唯一：DB 層兜底併發建立同名角色（handler check-then-insert 之外）（issue #71）
}, t => [uniqueIndex().on(t.weddingId, t.name)])

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
