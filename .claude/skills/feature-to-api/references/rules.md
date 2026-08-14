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

**回應信封依 [openapi-conventions.md §3](./openapi-conventions.md)：模式 A envelope（`ok()`/`page()` 包裝，useHttp 拆封）／模式 B 裸回，同一專案固定一種；軟刪除 204 無 body 兩模式皆同；絕不自創第三種包裝（如 `{ status, data, meta }`）——正反例與判定規則見 §3，勿在此複製。**

**錯誤用 `statusMessage`，不用 `message`：**

```typescript
// [O]
throw createError({ statusCode: 404, statusMessage: '帳號不存在' })

// [X] message 不會被 Nuxt 自動帶到 error.statusMessage，前端讀不到
throw createError({ statusCode: 404, message: '帳號不存在' })
```

**對齊鏈路：**
1. `spec/api/api-spec.yml`（若存在）= 最終 SoT
2. `types/api/*.ts` 鏡像 OpenAPI schema（camelCase 欄位、Event/ListItem/Body 命名）——view 型別永遠是裸 schema，envelope 外層不寫進型別
3. `server/mock/data/*.ts` 的 mock 結構與型別一致（camelCase）
4. `server/api/**/*.ts` 回應外層依 §3 模式（A：envelope helper 包裝／B：裸回）
5. `app/*` 經 `useHttp` 拿到裸 `T`（envelope 模式由 useHttp 自動拆封，**不手動 `.data` 解包**）
