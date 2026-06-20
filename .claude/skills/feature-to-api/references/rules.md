# 共用規則（API 合約層）

> `/feature-to-api` 的 Phase 0-1 共用規則。

---

## Server API 類型規範 `[P1]`

```typescript
// event 必須標 H3Event
import type { H3Event } from 'h3'
export default defineEventHandler(async (event: H3Event) => { ... })

// noUncheckedIndexedAccess：陣列用 ! 斷言
const item = items[index]!
item.name = 'new'
```

### Mock API 回傳慣例 `[P1]`（OpenAPI 對齊版，穩定迭代核心規則）

> ⚠️ 此規則確保 `api-spec.yml` ↔ `types/api/` ↔ `mock data` ↔ `API 回傳` ↔ `頁面消費` 五層永遠對齊。
> 完整慣例見 [openapi-conventions.md](./openapi-conventions.md)（§3 response shape、§4 錯誤、§5 HTTP code）。

**API 端點直接回傳 schema 物件 / 陣列，不包裝：**

```typescript
// [O] 直接回 schema 裸物件 / 陣列（型別 1:1 對齊 OpenAPI / types/api/）
return mockTeams.filter(t => !t.deletedAt) // GET 列表
return createdEvent // POST 建立
setResponseStatus(event, 204) // 軟刪除無 body

// [X] 禁止 { status, data, meta } 包裝（與 OpenAPI 不一致，未來會全面回修）
return { status: 'success' as const, data: paged, meta: { total, page, page_size } }
```

**錯誤用 `statusMessage`，不用 `message`：**

```typescript
// [O]
throw createError({ statusCode: 404, statusMessage: '帳號不存在' })

// [X] message 不會被 Nuxt 自動帶到 error.statusMessage，前端讀不到
throw createError({ statusCode: 404, message: '帳號不存在' })
```

**對齊鏈路：**
1. `spec/api/api-spec.yml`（若存在）= 最終 SoT
2. `types/api/*.ts` 鏡像 OpenAPI schema（camelCase 欄位、Event/ListItem/Body 命名）
3. `server/mock/data/*.ts` 的 mock 結構與型別一致（camelCase）
4. `server/api/**/*.ts` 直接回 schema 物件 / 陣列，不包裝
5. `app/composables/*.ts` 用 `$fetch<T>` 直接拿到 `T`，**無 `.data` 解包**
