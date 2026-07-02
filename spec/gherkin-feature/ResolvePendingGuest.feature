# language: en
# 手動撰寫（批次 3 新功能）

Feature: 處理待確認賓客
  管理員人工處理公開自助回覆：併入既有賓客 / 建為新賓客 / 略過（系統永不自動合併）

  @happy-path @happy-path
  Rule: 成功併入既有賓客
    待確認賓客併入指定的正式賓客

    Scenario: 併入既有賓客
      已有正式賓客與一筆待確認回覆，管理員選擇併入
      Given the GuestAdded event has occurred on stream "guest-001":
        """
        {
          "diet": "meat",
          "name": "陳大明",
          "side": "groom",
          "notes": "",
          "contact": "0912345678",
          "category": "朋友",
          "weddingId": "wedding-001",
          "childChairCount": 0
        }
        """
      And the PublicRsvpSubmitted event has occurred on stream "guest-900":
        """
        {
          "weddingId": "wedding-001",
          "status": "pending_review"
        }
        """
      When Admin sends MergePendingGuest on stream "guest-900":
        """
        {
          "targetGuestId": "guest-001"
        }
        """
      Then the PendingGuestMerged event is emitted with:
        """
        {
          "guestId": "guest-900",
          "targetGuestId": "guest-001"
        }
        """

  @happy-path @confirm
  Rule: 成功建為新賓客
    待確認賓客轉為正式名單

    Scenario: 建為新賓客
      管理員把待確認賓客建為正式賓客
      Given the PublicRsvpSubmitted event has occurred on stream "guest-900":
        """
        {
          "weddingId": "wedding-001",
          "status": "pending_review"
        }
        """
      When Admin sends ConfirmPendingGuest on stream "guest-900":
        """
        {}
        """
      Then the PendingGuestConfirmed event is emitted with:
        """
        {
          "guestId": "guest-900"
        }
        """

  @happy-path @reject
  Rule: 成功略過
    管理員略過待確認回覆

    Scenario: 略過待確認賓客
      管理員略過一筆待確認回覆
      Given the PublicRsvpSubmitted event has occurred on stream "guest-900":
        """
        {
          "weddingId": "wedding-001",
          "status": "pending_review"
        }
        """
      When Admin sends RejectPendingGuest on stream "guest-900":
        """
        {}
        """
      Then the PendingGuestRejected event is emitted with:
        """
        {
          "guestId": "guest-900"
        }
        """

  @not-found @pending-not-found
  Rule: 待確認賓客不存在
    指定的待確認賓客不存在時拒絕操作

    Scenario: 待確認賓客不存在
      該待確認賓客不存在
      Given no prior events
      When Admin sends ConfirmPendingGuest on stream "guest-999":
        """
        {}
        """
      Then the operation fails with: 待確認賓客不存在
