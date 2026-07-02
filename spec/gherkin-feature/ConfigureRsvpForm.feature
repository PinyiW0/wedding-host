# language: en
# 手動撰寫（批次 3 新功能，本 repo 無 codegen，直接以此為來源）

Feature: 設定 RSVP 表單
  管理員設定賓客 RSVP 表單的題目（系統題開關／標籤／排序、自訂題）與外觀（模板／banner）

  @happy-path @happy-path
  Rule: 成功設定 RSVP 表單
    婚禮存在時成功設定表單題目與外觀

    Scenario: 成功設定 RSVP 表單
      婚禮已建立，管理員停用接駁車題、新增一題自訂題並切換模板
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
      When Admin sends ConfigureRsvpForm on stream "wedding-001":
        """
        {
          "weddingId": "wedding-001",
          "theme": "floral",
          "banner": null,
          "questions": [
            { "type": "builtin", "key": "attending", "label": "是否會出席婚禮？", "enabled": true, "order": 1 },
            { "type": "builtin", "key": "shuttle", "label": "高雄地區接駁車", "enabled": false, "order": 2 },
            { "type": "single", "id": "q-song", "label": "想點播的歌曲？", "required": false, "order": 3, "options": [{ "value": "ballad", "label": "抒情" }, { "value": "rock", "label": "搖滾" }] }
          ]
        }
        """
      Then the RsvpFormConfigured event is emitted with:
        """
        {
          "weddingId": "wedding-001",
          "theme": "floral"
        }
        """

  @not-found @wedding-not-found
  Rule: 婚禮不存在
    指定的婚禮不存在時拒絕設定

    Scenario: 婚禮不存在
      婚禮尚未建立，設定表單失敗
      Given no prior events
      When Admin sends ConfigureRsvpForm on stream "wedding-001":
        """
        {
          "weddingId": "wedding-001",
          "theme": "minimal",
          "banner": null,
          "questions": []
        }
        """
      Then the operation fails with: 婚禮不存在
