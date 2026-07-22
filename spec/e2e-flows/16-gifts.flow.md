# Flow: 婚禮小物規劃

> 對應規格：spec/gherkin-feature/AddGiftItem.feature、UpdateGiftItem.feature、RemoveGiftItem.feature
> 涵蓋頁面：後台婚禮小物 /weddings/[weddingId]/gifts（管理者/新人）

## Background
- 新人規劃多類禮物，類別為婚禮層級字典、可自訂（新增／改名／刪除，issue #124）；預設提供六類：桌上禮（table）、二進禮（second_entrance）、遊戲禮（game）、送客禮（send_off）、探房禮（room_visit）、喝茶禮（tea_ceremony）
- 每筆品項：款式說明（識別欄位，必填）、圖片（dataURL）、單價、數量、購買網址、預計發放時間、運費一、運費二、其他、備註
- 金額讀模型（前端計算不落庫）：小計＝單價×數量；品項總計＝小計＋運費一＋運費二＋其他；頁面呈現各類別小計與全部總額
- 頁面頂部顯示採買參考數（出席大人數/兒童椅數/桌數），資料源自賓客與桌次

---

## Business Invariants（合約核心）

1. 管理員能在婚禮的禮物類別下新增禮物品項（類別可自訂，預設提供六類），品項落在正確類別區塊
2. 管理員能更新既有品項欄位、能移除既有品項
3. 品項以款式說明識別，可被使用者讀到
4. 金額語意為合約：小計＝單價×數量；品項總計＝小計＋運費一＋運費二＋其他；各類別小計與全部總額可被讀到
5. 採買參考數（出席大人數/兒童椅數/桌數）可被讀到，且與賓客、桌次資料一致
6. 對不存在品項的操作，使用者能感知失敗（「禮物品項不存在」）
7. 類別可新增、改名、刪除；改名不影響既有品項歸屬；仍有品項的類別不可刪除，使用者能感知失敗（「此類別仍有品項」）

---

## Flow: 新增禮物品項（happy-path）

> 對應 Feature: 新增禮物品項 → Scenario: 成功新增禮物品項

### 業務脈絡
- wedding-001 已建立，管理員已登入

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/gifts`
2. 在送客禮類別新增品項（款式說明「手工喜糖小盒」、單價 35、數量 180、運費一 120）
3. 品項出現在送客禮區塊，金額正確（小計 6,300、總計 6,420）

### Verification 策略
- API spy：`POST .../gift-items`，payload 含 category/description/unitPrice/quantity/shippingFee1
- UI：品項可見於正確類別、成功回饋

---

## Flow: 更新禮物品項（happy-path + not-found）

> 對應 Feature: 更新禮物品項

### E2E 驗證流程
1. 編輯 seed 品項（拉花小熊桌上禮），改數量 150、運費一 150
2. 更新後金額重算正確
3. not-found：直接對 `giftitem-999` 發 PATCH → 404「禮物品項不存在」

### Verification 策略
- API spy：`PATCH .../gift-items/{giftItemId}`
- 404 以 `page.request` 直打驗證

---

## Flow: 移除禮物品項（happy-path + not-found）

> 對應 Feature: 移除禮物品項

### E2E 驗證流程
1. 移除 seed 品項 → 品項不再可見、成功回饋
2. not-found：直接對 `giftitem-999` 發 DELETE → 404「禮物品項不存在」

---

## Flow: 金額與採買參考（讀模型合約）

### E2E 驗證流程
1. 進入頁面，斷言 seed 金額：桌上禮小計 6,100、送客禮小計 12,250、全部總額 18,350
2. 斷言採買參考數與 guests/tables seed 推得數字一致

### 不再凍結
- 卡片/表格呈現、表單 modal 形式、圖片上傳互動、類別區塊排版、金額格式化樣式、參考卡視覺

---

## Mock 假設
- seed：每場婚禮帶預設六類（categoryId 沿用 slug：table…tea_ceremony，subtotal testid 依此定位）
- seed：`giftitem-001` 桌上禮「拉花小熊桌上禮」單價 50×120、運費 100/0/0（小計 6,000、總計 6,100）
- seed：`giftitem-002` 送客禮「乾燥花束送客禮」單價 80×150、運費 200/50/0（小計 12,000、總計 12,250）
- 全部總額 18,350
- 端點：GET/POST `.../gift-items`、PATCH/DELETE `.../gift-items/{giftItemId}`；POST 缺 description → 400「請輸入款式說明」、帶不存在類別 → 400「禮物類別不存在」
- 端點：GET/POST `.../gift-categories`、PATCH/DELETE `.../gift-categories/{categoryId}`；同名 → 409「類別名稱已存在」、有品項刪除 → 409「此類別仍有品項」
