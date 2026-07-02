# Flow: 投影即時牆

> 對應規格：spec/gherkin-feature/ProjectBlessing.feature
> 涵蓋頁面：投影即時牆 /projection/[weddingId]（公開全螢幕）、後台投影祝福審核 /weddings/[weddingId]/blessings（推到投影幕）

## Background
- 投影牆全螢幕輪播已通過審核（approved）的祝福 + 賓客名 + emoji + 花圖裝飾
- 通過審核即進入「待上牆」；管理員可「推到投影幕」標記為「已上牆」（避免重播）
- 即時推送：mock 用 BroadcastChannel（approve / project → 投影頁即時）+ 短輪詢 fallback；正式 M0 改 WebSocket/SSE
- 只播 approved；可即時隱藏不當內容（拒絕既有流程）

---

## Business Invariants（合約核心）

1. 投影牆只呈現已通過審核的祝福
2. 已通過審核的祝福能被推到投影幕（標記已上牆）
3. 未通過審核的祝福不可推到投影幕
4. 祝福不存在時操作失敗，使用者能感知原因
5. emoji 隨祝福訊息正確顯示（message 為字串可含 emoji）

---

## Flow: 推到投影幕（happy-path）

> 對應 Feature: 推到投影幕 → Scenario: 推到投影幕

### 業務脈絡
- blessing-001 已提交並通過審核

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/blessings`
2. 通過某祝福
3. 在該祝福按「推到投影幕」

### Verification 策略
- API spy：`POST .../blessings/{blessingId}/project`，回應 wallStatus=on_wall
- UI：上牆狀態顯示「已上牆」

### 不再凍結
- 投影牆視覺、輪播節奏、推送機制、上牆狀態呈現

---

## Flow: 投影牆呈現已通過祝福（happy-path，公開端）

### 業務脈絡
- blessing-001 已通過審核

### E2E 驗證流程
1. 進入 `/projection/wedding-001`
2. 投影牆顯示該祝福訊息

### Verification 策略
- UI：投影訊息可見（getByTestId('projection-message') 含祝福內容）

---

## Flow: 未通過審核 / 祝福不存在（condition / not-found）

> 對應 Feature: 推到投影幕 → Scenario: 祝福尚未通過審核 / 祝福不存在

### 性質
API 邊界保護。

### 驗證流程
- 未審核祝福 `POST .../blessings/{id}/project` → 4xx「祝福尚未通過審核」
- `POST .../blessings/blessing-999/project` → 4xx「祝福不存在」

---

## Mock 假設
- seed：wedding-001、blessing-001/002/003（皆 submitted）、guest-001/002/003
- `POST .../blessings/{id}/approve` 通過後 wallStatus=pending_wall
- `POST .../blessings/{id}/project` 回 BlessingProjectedEvent（wallStatus=on_wall）；未審核回 409「祝福尚未通過審核」；不存在回 404「祝福不存在」
- 投影即時推送為純前端（BroadcastChannel + 輪詢），時序敏感不進主 spec
