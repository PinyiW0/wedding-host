# language: en
# 手動撰寫（批次 4 新功能，本 repo 無 codegen，直接以此為來源）

Feature: 移除禮物品項
  管理員移除既有禮物品項

  @happy-path @happy-path
  Rule: 成功移除禮物品項
    管理員成功移除一筆禮物品項

    Scenario: 成功移除禮物品項
      Given the GiftItemAdded event has occurred on stream "giftitem-001":
        """
        {
          "weddingId": "wedding-001",
          "category": "table",
          "description": "拉花小熊桌上禮"
        }
        """
      When Admin sends RemoveGiftItem on stream "giftitem-001":
        """
        {}
        """
      Then the GiftItemRemoved event is emitted with:
        """
        {
          "giftItemId": "giftitem-001"
        }
        """

  Rule: 品項不存在時移除失敗
    對不存在的品項移除，操作失敗且使用者可感知

    Scenario: 移除不存在的禮物品項
      Given no prior events
      When Admin sends RemoveGiftItem on stream "giftitem-999":
        """
        {}
        """
      Then the command is rejected with error "禮物品項不存在"
