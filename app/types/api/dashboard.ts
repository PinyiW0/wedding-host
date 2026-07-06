// 婚禮儀表板統計（issue #11）：出席率／報到進度／禮金統計／待確認賓客數
// 母集＝未軟刪且非待審核的正式名單；一位賓客一「組」（partySize 為該組人數）

export interface DashboardStats {
  rsvp: {
    totalGroups: number // 正式名單總組數
    attending: number // 已回覆出席（組）
    declined: number // 已回覆不出席（組）
    pending: number // 待回覆（未提交或 absent，組）
  }
  attendance: {
    headcount: number // 出席總人數（出席組 partySize 加總）
    adults: number // 大人（partySize − childChairCount）
    children: number // 小孩（兒童椅）
    vegetarian: number // 素食（組）
  }
  checkIn: {
    checkedIn: number // 已報到（組）
    expected: number // 預期出席（組）＝已回覆出席
  }
  giftMoney: {
    totalAmount: number // 禮金總額（元）
    recordCount: number // 已登記筆數
  }
  pendingReviewCount: number // 待審核賓客（RSVP 公開表單提交、待新人確認）
}
