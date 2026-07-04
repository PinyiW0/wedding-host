# language: en
# 手動撰寫（批次 3 新功能）

Feature: 公開自助 RSVP
  賓客透過公開連結自助回覆，建立待確認賓客（不直接進正式名單）

  @happy-path @happy-path
  Rule: 成功公開回覆
    婚禮存在時建立待確認賓客

    Scenario: 公開自助回覆
      婚禮已建立，賓客透過公開頁回覆
      Given the WeddingCreated event has occurred on stream "wedding-001":
        """
        {
          "date": "2026-12-01T12:00:00.000Z",
          "title": "小明與小美的婚禮",
          "venue": "台北圓山飯店",
          "address": "台北市中山區中山北路四段1號",
          "adminId": "admin-001"
        }
        """
      When Guest sends SubmitPublicRsvp on stream "wedding-001":
        """
        {
          "guestName": "王小明",
          "phone": "0912345678",
          "relationship": "groom",
          "attending": "attending",
          "diet": "meat",
          "plusOneCount": 1,
          "childChairCount": 0
        }
        """
      Then the PublicRsvpSubmitted event is emitted with:
        """
        {
          "weddingId": "wedding-001",
          "status": "pending_review"
        }
        """

  @not-found @wedding-not-found
  Rule: 婚禮不存在
    指定的婚禮不存在時拒絕回覆

    Scenario: 婚禮不存在
      婚禮尚未建立，公開回覆失敗
      Given no prior events
      When Guest sends SubmitPublicRsvp on stream "wedding-001":
        """
        {
          "guestName": "王小明",
          "attending": "attending",
          "diet": "meat",
          "plusOneCount": 0,
          "childChairCount": 0
        }
        """
      Then the operation fails with: 婚禮不存在
