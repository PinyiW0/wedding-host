# language: en
# 手動撰寫（批次 4 新功能，本 repo 無 codegen，直接以此為來源）

Feature: 更新禮物品項
  管理員更新既有禮物品項的欄位（款式說明/單價/數量/圖片/網址/發放時間/費用/備註）

  @happy-path @happy-path
  Rule: 成功更新禮物品項
    管理員成功更新一筆禮物品項

    Scenario: 成功更新禮物品項
      管理員調整既有品項的數量與運費
      Given the GiftItemAdded event has occurred on stream "giftitem-001":
        """
        {
          "weddingId": "wedding-001",
          "category": "table",
          "description": "拉花小熊桌上禮",
          "unitPrice": 50,
          "quantity": 120
        }
        """
      When Admin sends UpdateGiftItem on stream "giftitem-001":
        """
        {
          "quantity": 150,
          "shippingFee1": 150
        }
        """
      Then the GiftItemUpdated event is emitted with:
        """
        {
          "giftItemId": "giftitem-001",
          "quantity": 150,
          "shippingFee1": 150
        }
        """

  Rule: 品項不存在時更新失敗
    對不存在的品項更新，操作失敗且使用者可感知

    Scenario: 更新不存在的禮物品項
      Given no prior events
      When Admin sends UpdateGiftItem on stream "giftitem-999":
        """
        {
          "quantity": 10
        }
        """
      Then the command is rejected with error "禮物品項不存在"
