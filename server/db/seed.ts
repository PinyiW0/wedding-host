import type { Db } from './index'
import { getTableName, sql } from 'drizzle-orm'
import {
  mockBlessings,
  mockCakeBoxAssignments,
  mockCakeBoxExclusions,
  mockCakeBoxExtraOrders,
  mockCakeBoxTypes,
  mockEtiquetteSettings,
  mockEtiquetteWarnings,
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

const ALL_TABLES = [
  schema.users,
  schema.receptionAccounts,
  schema.weddings,
  schema.guests,
  schema.guestCategories,
  schema.blessings,
  schema.giftItems,
  schema.cakeBoxTypes,
  schema.cakeBoxAssignments,
  schema.cakeBoxExclusions,
  schema.cakeBoxExtraOrders,
  schema.seatingTables,
  schema.seats,
  schema.venueLayouts,
  schema.venueMarkers,
  schema.etiquetteSettings,
  schema.etiquetteWarnings,
  schema.rundownRoles,
  schema.rundownItems,
  schema.rsvpFormConfigs,
  schema.lineOas,
  schema.thankYouTemplates,
  schema.thankYouCustomizations,
  schema.projectionSettings,
]

export async function seedDb(db: Db): Promise<void> {
  // 無 FK 約束、彼此獨立，可並行插入；空 store 略過
  const jobs: Promise<unknown>[] = []
  if (mockUsers.length)
    jobs.push(db.insert(schema.users).values(mockUsers))
  if (mockReceptionAccounts.length)
    jobs.push(db.insert(schema.receptionAccounts).values(mockReceptionAccounts))
  if (mockWeddings.length)
    jobs.push(db.insert(schema.weddings).values(mockWeddings))
  if (mockGuests.length)
    jobs.push(db.insert(schema.guests).values(mockGuests))
  if (mockGuestCategories.length)
    jobs.push(db.insert(schema.guestCategories).values(mockGuestCategories))
  if (mockBlessings.length)
    jobs.push(db.insert(schema.blessings).values(mockBlessings))
  if (mockGiftItems.length)
    jobs.push(db.insert(schema.giftItems).values(mockGiftItems))
  if (mockCakeBoxTypes.length)
    jobs.push(db.insert(schema.cakeBoxTypes).values(mockCakeBoxTypes))
  if (mockCakeBoxAssignments.length)
    jobs.push(db.insert(schema.cakeBoxAssignments).values(mockCakeBoxAssignments))
  if (mockCakeBoxExclusions.length)
    jobs.push(db.insert(schema.cakeBoxExclusions).values(mockCakeBoxExclusions))
  if (mockCakeBoxExtraOrders.length)
    jobs.push(db.insert(schema.cakeBoxExtraOrders).values(mockCakeBoxExtraOrders))
  if (mockTables.length)
    jobs.push(db.insert(schema.seatingTables).values(mockTables))
  if (mockSeats.length)
    jobs.push(db.insert(schema.seats).values(mockSeats))
  if (mockVenueLayouts.length)
    jobs.push(db.insert(schema.venueLayouts).values(mockVenueLayouts))
  if (mockVenueMarkers.length)
    jobs.push(db.insert(schema.venueMarkers).values(mockVenueMarkers))
  if (mockEtiquetteSettings.length)
    jobs.push(db.insert(schema.etiquetteSettings).values(mockEtiquetteSettings))
  if (mockEtiquetteWarnings.length)
    jobs.push(db.insert(schema.etiquetteWarnings).values(mockEtiquetteWarnings))
  if (mockRundownRoles.length)
    jobs.push(db.insert(schema.rundownRoles).values(mockRundownRoles))
  if (mockRundownItems.length)
    jobs.push(db.insert(schema.rundownItems).values(mockRundownItems))
  if (mockRsvpFormConfigs.length)
    jobs.push(db.insert(schema.rsvpFormConfigs).values(mockRsvpFormConfigs))
  if (mockLineOas.length)
    jobs.push(db.insert(schema.lineOas).values(mockLineOas))
  if (mockThankYouTemplates.length)
    jobs.push(db.insert(schema.thankYouTemplates).values(mockThankYouTemplates))
  if (mockThankYouCustomizations.length)
    jobs.push(db.insert(schema.thankYouCustomizations).values(mockThankYouCustomizations))
  if (mockProjectionSettings.length)
    jobs.push(db.insert(schema.projectionSettings).values(mockProjectionSettings))
  await Promise.all(jobs)
}

// e2e reset：清空全表後回填 seed（語意同原 resetMockData 的「還原初始快照」）
export async function resetDb(db: Db): Promise<void> {
  const names = ALL_TABLES.map(t => `"${getTableName(t)}"`).join(', ')
  await db.execute(sql.raw(`TRUNCATE TABLE ${names} RESTART IDENTITY`))
  await seedDb(db)
}

// dev 啟動用：資料庫是空的才 seed（保留開發者手動改過的資料）
export async function seedDbIfEmpty(db: Db): Promise<void> {
  const [row] = await db.select({ weddingId: schema.weddings.weddingId }).from(schema.weddings).limit(1)
  if (!row)
    await seedDb(db)
}
