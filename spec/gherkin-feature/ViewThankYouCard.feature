# language: en
# 手動撰寫（批次 3 新功能；本功能為唯讀查詢，以 Then 回應內容描述）

Feature: 賓客公開謝卡
  賓客透過專屬連結開啟謝卡，內容自動帶入賓客名（客製優先，否則統一範本）

  @happy-path @happy-path
  Rule: 成功讀取謝卡
    婚禮與賓客存在時回已解析的謝卡內容

    Scenario: 讀取賓客謝卡
      婚禮已建立、賓客存在、已設定謝卡範本
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
      And the GuestAdded event has occurred on stream "guest-001":
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
      And the ThankYouTemplateSet event has occurred on stream "wedding-001":
        """
        {
          "templateContent": "親愛的{{guestName}}，謝謝您的祝福"
        }
        """
      When guest-001 opens ViewThankYouCard on stream "wedding-001"
      Then the thank you card contains:
        """
        {
          "guestId": "guest-001",
          "guestName": "陳大明",
          "content": "親愛的陳大明，謝謝您的祝福"
        }
        """

  @not-found @guest-not-found
  Rule: 賓客不存在
    指定賓客不存在時拒絕讀取

    Scenario: 賓客不存在
      該賓客不存在
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
      When guest-999 opens ViewThankYouCard on stream "wedding-001"
      Then the operation fails with: 賓客不存在
