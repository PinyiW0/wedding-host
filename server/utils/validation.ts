// 共用輸入驗證（issue #70）：數字欄防 NaN／浮點／int4 溢位／負值，enum 欄執行期白名單
// PostgreSQL integer 為 int4，超過上限會 out-of-range 擲 500，一律先以 400 擋在入口
const INT_MAX = 2_147_483_647

// 驗證為非負整數（預設上限 int4，可縮小）；非數字／非整數／負值／NaN／超界一律 400
export function assertPositiveInt(value: unknown, label: string, max = INT_MAX): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    throw createError({ statusCode: 400, statusMessage: `${label}格式不正確` })
  }
}

// 驗證字串值屬於白名單；不符一律 400（型別化欄位無 DB CHECK 約束，需執行期把關）
export function assertEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): void {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw createError({ statusCode: 400, statusMessage: `${label}不正確` })
  }
}
