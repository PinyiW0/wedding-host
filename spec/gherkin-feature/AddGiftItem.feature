# language: en
# 手動撰寫（批次 4 新功能，本 repo 無 codegen，直接以此為來源）

Feature: 新增禮物品項
  管理員在婚禮小物規劃中新增禮物品項（六類：桌上禮/二進禮/遊戲禮/送客禮/探房禮/喝茶禮）

  @happy-path @happy-path
  Rule: 成功新增禮物品項
    管理員成功新增一筆禮物品項

    Scenario: 成功新增禮物品項
      管理員在送客禮類別新增一筆禮物品項
      Given no prior events
      When Admin sends AddGiftItem on stream "giftitem-101":
        """
        {
          "weddingId": "wedding-001",
          "category": "send_off",
          "description": "手工喜糖小盒",
          "unitPrice": 35,
          "quantity": 180,
          "purchaseUrl": "https://shop.example.com/candy-box",
          "distributionTime": "送客時",
          "shippingFee1": 120,
          "shippingFee2": 0,
          "otherFee": 0,
          "note": "備 10% 餘量"
        }
        """
      Then the GiftItemAdded event is emitted with:
        """
        {
          "weddingId": "wedding-001",
          "category": "send_off",
          "description": "手工喜糖小盒",
          "unitPrice": 35,
          "quantity": 180,
          "shippingFee1": 120
        }
        """
