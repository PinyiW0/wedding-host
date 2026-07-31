// 選項按鈕（單選／多選／切換）的選中與未選樣式，賓客表單與後台設定頁共用
// 依 spec/ui-config/ui-reference/2-guest.html 設計稿：方角、選中＝墨底白字、未選＝紙底細框
// 方角是這套 Editorial Luxe 的關鍵——圓角會讓邀請函退化成一般 app 介面
// 墨底白字對比 18:1，明暗差本身就是非色相訊號，不需再靠勾或框粗細輔助
export function choiceProps(selected: boolean) {
  return selected
    ? {
        color: 'neutral' as const,
        variant: 'solid' as const,
        class: 'rounded-none',
      }
    : {
        color: 'neutral' as const,
        variant: 'outline' as const,
        class: 'rounded-none bg-paper',
      }
}
