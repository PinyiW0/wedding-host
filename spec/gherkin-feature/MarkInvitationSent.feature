# language: en
# 手動撰寫（批次 4 迭代新功能，本 repo 無 codegen，直接以此為來源）

Feature: 標記喜帖已寄送
  管理員在 RSVP 喜帖管理中逐位標記賓客的喜帖已寄送（冪等設值，可勾選可取消）

  @happy-path @happy-path
  Rule: 成功標記喜帖已寄送
    賓客存在時成功標記喜帖已寄送

    Scenario: 成功標記喜帖已寄送
      賓客已回覆需要電子喜帖，管理員寄出後標記已寄送
      Given the GuestCreated event has occurred on stream "guest-003":
        """
        {
          "weddingId": "wedding-001",
          "name": "王志強",
          "side": "groom",
          "diet": "meat",
          "category": "家人",
          "contact": "0933333333"
        }
        """
      When Admin sends MarkInvitationSent on stream "guest-003":
        """
        {
          "weddingId": "wedding-001",
          "guestId": "guest-003",
          "sent": true
        }
        """
      Then the InvitationSentMarked event is emitted with:
        """
        {
          "guestId": "guest-003",
          "invitationSent": true
        }
        """

  @not-found @guest-not-found
  Rule: 賓客不存在
    指定的賓客不存在時拒絕標記

    Scenario: 賓客不存在
      賓客不存在，標記喜帖已寄送失敗
      Given no prior events
      When Admin sends MarkInvitationSent on stream "guest-999":
        """
        {
          "weddingId": "wedding-001",
          "guestId": "guest-999",
          "sent": true
        }
        """
      Then the operation fails with: 賓客不存在
