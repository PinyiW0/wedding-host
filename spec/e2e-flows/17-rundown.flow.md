# Flow: 婚禮當天流程表（矩陣表）

> 對應規格：spec/gherkin-feature/AddRundownRole.feature、UpdateRundownRole.feature、RemoveRundownRole.feature、SaveRundownTable.feature、ApplyRundownTemplate.feature、ViewPublicRundown.feature
> 涵蓋頁面：後台當天流程 /weddings/[weddingId]/rundown（管理者/新人）；公開唯讀 /rundown/[weddingId]（免登入，可帶 ?role=）

## Background
- 新人自訂流程角色（預設 seed：接待、總場控、新秘、平面攝影師），可增刪改
- 流程表為矩陣表：列＝時間段（開始時間 HH:MM 或 null＝未定時段、時長分鐘）、固定欄（時間/主要事項/場地/物品/備註）、每角色一欄（該角色在此時段的個別事項，自由文字）
- 表格內直接編輯草稿，單一儲存鈕整表 PUT（SaveRundownTable）
- 宴客段範本（8 段）由前端帶入草稿：modal 填開始時間→預覽推算→帶入草稿→再按儲存才 PUT
- 工作人員透過免登入分享連結查看流程；帶角色參數只看該角色參與時段（roleTasks 含該角色）

---

## Business Invariants（合約核心）

1. 新人能自訂管理流程角色（新增/改名/移除）；同一婚禮角色名稱不重複（「角色名稱已存在」）
2. 矩陣語意：同一時段各角色各自的個別事項（roleTasks）可讀
3. 場地可填可讀
4. 表格內編輯＋單一儲存：整表 PUT 取代——既有列帶 rundownItemId 沿用、新列省略（後端配發）、**未帶回的既有列＝刪除（此語意為合約）**
5. 範本推算公式凍結：第一段＝startTime、第 n 段＝前段起始＋前段時長（18:00 起算 → 彩排・設備確認 18:00、送客・合照 21:05）；modal 內預覽可見；帶入僅進草稿，需再按儲存才 PUT
6. 可依角色篩選，僅顯示 roleTasks 含該角色的時段
7. 公開唯讀頁 `/rundown/{weddingId}` 免登入可讀；帶 `?role=` 依 roleTasks 篩選並顯示該角色的個別事項
8. 起訖時間可讀：訖時間＝開始時間＋時長（由前端推算顯示）
9. 400/404 語意：列缺主要事項→400「請輸入主要事項」；time 有填但非 HH:MM→400「時間格式錯誤」（空/null 允許）；對不存在角色操作→404「流程角色不存在」
10. 角色移除後，各項目的 roleTasks 不再含該角色的條目（級聯清理）

### 不再凍結
- 無時間列（time null）置頂的視覺呈現（GET 排序 null 置頂為 mock 行為，非 UI 凍結合約）
- 表格視覺、欄寬、列拖曳、角色欄排序、分享連結按鈕位置、匯出圖檔視覺與檔名、範本 modal 形式（僅凍結預覽容器與推算內容可見）

---

## Flow: 角色管理（happy-path + 重複 + not-found）

> 對應 Feature: 新增/更新/移除流程角色

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/rundown`，預設四角色可見
2. 新增「動態攝影」→ 可見、成功回饋
3. 改名、移除 → 對應更新
4. not-found：對 `role-999` 發 PATCH/DELETE → 404「流程角色不存在」
5. 級聯：刪 role-003 後，GET items 中 rundownitem-001 的 roleTasks 不含 role-003

### Verification 策略
- API spy：POST/PATCH/DELETE `.../rundown-roles`；404 以 `page.request` 直打；級聯以 `page.request.get` 驗欄位

---

## Flow: 矩陣表編輯與整表儲存（happy-path + 400）

> 對應 Feature: 儲存流程矩陣表

### E2E 驗證流程
1. 草稿表格內改既有列（title/location/角色欄）→ 按儲存 → PUT payload 該列帶原 rundownItemId 與新值
2. 新增一列（填開始/結束時間、title）→ 儲存 → payload 含一筆無 rundownItemId 的新列（durationMinutes＝訖−起）
3. 刪除列 → 儲存 → payload 不含該列（未帶回＝刪除）→ 該列不再可見
4. 400：`page.request.put` 帶 time '五點' → 400「時間格式錯誤」

### Verification 策略
- API spy：`PUT .../rundown-items` payload 逐列斷言；儲存後草稿值斷言

---

## Flow: 帶入宴客段範本（前端草稿）

> 對應 Feature: 帶入宴客段流程範本

### E2E 驗證流程
1. 點「帶入宴客段範本」開 modal，填開始時間 18:00
2. 預覽容器顯示推算結果：彩排 18:00 … 送客・合照 21:05
3. 按帶入 → 草稿多 8 列（尚未 PUT）
4. 按儲存 → PUT payload items 共 9 筆（seed 1＋範本 8），含 18:00 彩排・設備確認 與 21:05 送客・合照

### Verification 策略
- 預覽以 testid 容器斷言文字；帶入後以草稿列數斷言；最終以 PUT payload 斷言（推算正確性為合約）

---

## Flow: 角色篩選與公開頁

> 對應 Feature: 公開流程表

### E2E 驗證流程
1. 後台選角色「新秘」→ 草稿表格只顯示 roleTasks 含新秘的列
2. 未登入直接進 `/rundown/wedding-001` → seed 項目可見，含時間 16:30 與場地「新娘房」
3. `/rundown/wedding-001?role=role-003` → 僅顯示 roleTasks 含 role-003 的項目，且該角色個別事項文字可見

---

## Mock 假設
- seed 角色：role-001 接待、role-002 總場控、role-003 新秘、role-004 平面攝影師（wedding-001）
- seed 項目：rundownitem-001「新娘物品點交」time '16:30' / 20 分 / location '新娘房' / supplies '婚紗配件、備用鞋' / roleTasks [{ roleId: 'role-003', task: '婚紗配件、備用鞋檢查' }]（標題刻意避開範本 8 段字樣）
- 範本 `RUNDOWN_TEMPLATE` 移至前端 `app/utils/rundownTemplate.ts`（title/durationMinutes/location/supplies/roleTaskByName）：彩排・設備確認 15 宴會廳｛總場控/新秘｝→迎賓・收禮金 30 宴會廳入口｛接待｝→主持開場・一進 25 宴會廳｛總場控/平面攝影師｝→開桌上菜 10 宴會廳｛總場控｝→退場換裝 30 新娘房｛新秘｝→二進・遊戲・敬酒 45 宴會廳｛總場控/平面攝影師｝→二退換裝備送客 30 新娘房｛新秘｝→送客・合照 30 宴會廳門口｛全體｝
- roleTaskByName 以「名稱」對應帶入當下該婚禮現存角色，名稱不存在則略過；'all'＝當下全部角色（task 空字串）
- 端點：roles GET/POST/PATCH/DELETE、items GET（排序：time null 置頂，其餘依 time 升冪）、items PUT（整表取代：逐列驗 title 必填與 time 格式、roleTasks 過濾不存在的 roleId、既有列沿用 id/新列配發、就地 splice+push 保持陣列參照、回 200 RundownTableSavedEvent）
- 逐筆 POST/PATCH/DELETE 與 apply-template 端點已移除
- 公開頁直接重用 GET rundown-items / rundown-roles（mock 階段無 auth 攔截，正式 M0 再收斂 public 端點）
