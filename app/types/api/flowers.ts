// 花田：賓客手繪小花升級為可複用資產（花田 landing + 謝卡裝飾共用）

// 單朵花牆元素：賓客名 + 手繪小花（image dataURL，非空）
export interface FlowerWallItem {
  guestId: string
  name: string
  flowerDrawing: string
}
