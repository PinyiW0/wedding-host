import type { PgTable } from 'drizzle-orm/pg-core'
import type { Db } from './index'
import { getTableName, sql } from 'drizzle-orm'
import {
  mockBlessings,
  mockCakeBoxAssignments,
  mockCakeBoxExclusions,
  mockCakeBoxExtraOrders,
  mockCakeBoxTypes,
  mockGiftItems,
  mockGuestCategories,
  mockGuests,
  mockLineOas,
  mockProjectionSettings,
  mockReceptionAccounts,
  mockRsvpFormConfigs,
  mockRundownItems,
  mockRundownRoles,
  mockSeats,
  mockTables,
  mockThankYouCustomizations,
  mockThankYouTemplates,
  mockUsers,
  mockVenueLayouts,
  mockVenueMarkers,
  mockWeddings,
} from '../mock/data'
import * as schema from './schema'

// seed 資料沿用 server/mock/data 的陣列（M0-b 起 handler 不再 mutate 它們，僅作初始資料源）

// 交易 client 型別；neon-http 不支援 transaction，seed 只允許走本機 node-postgres 路徑（見 index.ts 的 neon 守門）
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

// 表 ↔ seed 來源配對（單一真源：TRUNCATE 清單與空表檢查都由此導出）；
// insert 用閉包保住各表的插入型別，rows 供空來源／空表判斷
interface SeedJob {
  table: PgTable
  rows: readonly unknown[]
  insert: (tx: Tx) => Promise<unknown>
}

const SEED_JOBS: SeedJob[] = [
  { table: schema.users, rows: mockUsers, insert: tx => tx.insert(schema.users).values(mockUsers) },
  { table: schema.receptionAccounts, rows: mockReceptionAccounts, insert: tx => tx.insert(schema.receptionAccounts).values(mockReceptionAccounts) },
  { table: schema.weddings, rows: mockWeddings, insert: tx => tx.insert(schema.weddings).values(mockWeddings) },
  { table: schema.guests, rows: mockGuests, insert: tx => tx.insert(schema.guests).values(mockGuests) },
  { table: schema.guestCategories, rows: mockGuestCategories, insert: tx => tx.insert(schema.guestCategories).values(mockGuestCategories) },
  { table: schema.blessings, rows: mockBlessings, insert: tx => tx.insert(schema.blessings).values(mockBlessings) },
  { table: schema.giftItems, rows: mockGiftItems, insert: tx => tx.insert(schema.giftItems).values(mockGiftItems) },
  { table: schema.cakeBoxTypes, rows: mockCakeBoxTypes, insert: tx => tx.insert(schema.cakeBoxTypes).values(mockCakeBoxTypes) },
  { table: schema.cakeBoxAssignments, rows: mockCakeBoxAssignments, insert: tx => tx.insert(schema.cakeBoxAssignments).values(mockCakeBoxAssignments) },
  { table: schema.cakeBoxExclusions, rows: mockCakeBoxExclusions, insert: tx => tx.insert(schema.cakeBoxExclusions).values(mockCakeBoxExclusions) },
  { table: schema.cakeBoxExtraOrders, rows: mockCakeBoxExtraOrders, insert: tx => tx.insert(schema.cakeBoxExtraOrders).values(mockCakeBoxExtraOrders) },
  { table: schema.seatingTables, rows: mockTables, insert: tx => tx.insert(schema.seatingTables).values(mockTables) },
  { table: schema.seats, rows: mockSeats, insert: tx => tx.insert(schema.seats).values(mockSeats) },
  { table: schema.venueLayouts, rows: mockVenueLayouts, insert: tx => tx.insert(schema.venueLayouts).values(mockVenueLayouts) },
  { table: schema.venueMarkers, rows: mockVenueMarkers, insert: tx => tx.insert(schema.venueMarkers).values(mockVenueMarkers) },
  { table: schema.rundownRoles, rows: mockRundownRoles, insert: tx => tx.insert(schema.rundownRoles).values(mockRundownRoles) },
  { table: schema.rundownItems, rows: mockRundownItems, insert: tx => tx.insert(schema.rundownItems).values(mockRundownItems) },
  { table: schema.rsvpFormConfigs, rows: mockRsvpFormConfigs, insert: tx => tx.insert(schema.rsvpFormConfigs).values(mockRsvpFormConfigs) },
  { table: schema.lineOas, rows: mockLineOas, insert: tx => tx.insert(schema.lineOas).values(mockLineOas) },
  { table: schema.thankYouTemplates, rows: mockThankYouTemplates, insert: tx => tx.insert(schema.thankYouTemplates).values(mockThankYouTemplates) },
  { table: schema.thankYouCustomizations, rows: mockThankYouCustomizations, insert: tx => tx.insert(schema.thankYouCustomizations).values(mockThankYouCustomizations) },
  { table: schema.projectionSettings, rows: mockProjectionSettings, insert: tx => tx.insert(schema.projectionSettings).values(mockProjectionSettings) },
]

// 循序插入：同一交易連線內不可並行下查詢；失敗時帶上表名讓錯誤可定位
async function insertJobs(tx: Tx, jobs: SeedJob[]): Promise<void> {
  for (const job of jobs) {
    if (!job.rows.length)
      continue
    try {
      await job.insert(tx)
    }
    catch (err) {
      throw new Error(`seed 插入 ${getTableName(job.table)} 失敗`, { cause: err })
    }
  }
}

// 整包單一 transaction：任一表失敗全部回滾，不留半 seed 狀態（issue #100）
export async function seedDb(db: Db): Promise<void> {
  await db.transaction(tx => insertJobs(tx, SEED_JOBS))
}

// e2e reset：清空全表後回填 seed（語意同原 resetMockData 的「還原初始快照」）；
// TRUNCATE 與回填同一 transaction，失敗連清空一起回滾
export async function resetDb(db: Db): Promise<void> {
  const names = SEED_JOBS.map(j => `"${getTableName(j.table)}"`).join(', ')
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`TRUNCATE TABLE ${names} RESTART IDENTITY`))
    await insertJobs(tx, SEED_JOBS)
  })
}

// dev 啟動用：逐表檢查，mock 源非空但表為空 → 回填該表；有資料的表不動
// （半 seed 狀態自癒，issue #100；保留開發者手動改過的資料）
export async function seedMissingTables(db: Db): Promise<void> {
  const missing: SeedJob[] = []
  for (const job of SEED_JOBS) {
    if (!job.rows.length)
      continue
    const found = await db.select({ one: sql<number>`1` }).from(job.table).limit(1)
    if (!found.length)
      missing.push(job)
  }
  if (missing.length)
    await db.transaction(tx => insertJobs(tx, missing))
}
