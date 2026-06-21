// 統一 re-export mock 資料
import { mockReceptionAccounts } from './accounts'
import { mockBlessings } from './blessings'
import { mockCakeBoxAssignments, mockCakeBoxTypes } from './cakebox'
import { mockGuests } from './guests'
import { mockLineOas } from './line'
import {
  mockEtiquetteSettings,
  mockEtiquetteWarnings,
  mockSeats,
  mockTables,
  mockVenueLayouts,
} from './seating'
import { mockThankYouCustomizations, mockThankYouTemplates } from './thankyou'
import { mockUsers } from './users'
import { mockWeddings } from './weddings'

export { mockReceptionAccounts } from './accounts'
export { mockBlessings } from './blessings'
export { mockCakeBoxAssignments, mockCakeBoxTypes } from './cakebox'
export { mockGuests } from './guests'
export { mockLineOas } from './line'
export {
  mockEtiquetteSettings,
  mockEtiquetteWarnings,
  mockSeats,
  mockTables,
  mockVenueLayouts,
} from './seating'
export { mockThankYouCustomizations, mockThankYouTemplates } from './thankyou'
export { getMockCurrentUser, mockUsers } from './users'
export { mockWeddings } from './weddings'

// 所有 mock store 集中登記。API handler 直接 import 並就地 mutate 這些陣列參照，
// 故 reset 不能重新賦值變數，只能就地清空再回填初始快照（保持參照不變）。
const stores = [
  mockReceptionAccounts,
  mockBlessings,
  mockCakeBoxAssignments,
  mockCakeBoxTypes,
  mockGuests,
  mockLineOas,
  mockEtiquetteSettings,
  mockEtiquetteWarnings,
  mockSeats,
  mockTables,
  mockVenueLayouts,
  mockThankYouCustomizations,
  mockThankYouTemplates,
  mockUsers,
  mockWeddings,
] as unknown[][]

// 模組首次載入時，深拷貝各 store 的初始值作為還原基準（snapshot）
const initialSnapshots = stores.map(store => structuredClone(store))

/**
 * 將所有 mock store 重設為初始值（深拷貝）。
 * 就地清空陣列再回填快照，確保所有持有同一參照的 API handler 都看到重設後的資料。
 */
export function resetMockData(): void {
  stores.forEach((store, i) => {
    store.length = 0
    store.push(...structuredClone(initialSnapshots[i]!))
  })
}
