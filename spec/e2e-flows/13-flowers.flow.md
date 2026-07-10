# Flow: 祝福花田

> 對應規格：spec/gherkin-feature/ViewFlowerField.feature
> 涵蓋頁面：花田 landing /flowers/[weddingId]（賓客端，公開，RWD）；共用元件 FlowerField.vue（landing + 謝卡裝飾）

## Background
- 賓客在 RSVP 時可畫下手繪小花（存 flowerDrawing）
- 花田 landing 公開呈現該婚禮所有非空手繪小花（賓客名不公開顯示——產品決策 2026-07-10，識別由圖片 alt 承擔）
- 同一元件 FlowerField 亦用於謝卡裝飾（取樣少量、非互動）

---

## Business Invariants（合約核心）

1. 花田能公開呈現該婚禮所有非空手繪小花，每朵對應一位賓客
2. 待確認 / 已移除賓客的花不納入
3. 尚無任何手繪小花時，花田顯示空狀態（不報錯）

---

## Flow: 呈現花田（happy-path）

> 對應 Feature: 祝福花田 → Scenario: 呈現花田

### 業務脈絡
- wedding-001 已建立
- guest-003（王志強）已畫下手繪小花（seed）

### E2E 驗證流程
1. 進入 `/flowers/wedding-001`
2. 花田顯示所有手繪小花（不顯示賓客名）

### Verification 策略
- API spy / 直接查詢：`GET .../weddings/wedding-001/flowers`，回應含 guestId=guest-003 / name=王志強 / 非空 flowerDrawing
- UI：花田元件渲染（花朵圖可見；賓客識別由 alt 承擔）

### 不再凍結
- 花朵散佈方式、密度、互動（hover 放大 / 顯示名）、landing 視覺

---

## Mock 假設
- seed：wedding-001、guest-003（王志強 / 已畫花）
- `GET .../flowers` 回 FlowerWallItem[]（僅非空 flowerDrawing、排除 pending_review / 已移除）
