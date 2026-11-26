import { getTableColumns } from 'drizzle-orm'

import { guests } from './schema'

// 賓客的「輕量欄位」：排除 blessing 與 flowerDrawing（base64 手繪花圖，每張數十 KB）。
// 不需要這兩欄的查詢一律用 db.select(guestSlimColumns)，不要用無參數的 db.select()——
// 整列撈會把花圖一起拖出資料庫，輪詢端點這樣寫曾讓正式站傳輸量超過額度（issue #224、PR #223）。
const { blessing: _blessing, flowerDrawing: _flowerDrawing, ...slim } = getTableColumns(guests)

export const guestSlimColumns = slim
