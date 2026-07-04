# language: en
# 手動撰寫（批次 3 新功能；本功能為唯讀查詢，以 Then 回應內容描述）

Feature: 祝福花田
  賓客手繪小花升級為可複用資產，公開花田呈現所有非空手繪小花與賓客名

  @happy-path @happy-path
  Rule: 成功呈現花田
    婚禮存在時回所有非空手繪小花

    Scenario: 呈現花田
      婚禮已建立，已有賓客畫下手繪小花
      Given the GuestAdded event has occurred on stream "guest-003":
        """
        {
          "diet": "meat",
          "name": "王志強",
          "side": "groom",
          "notes": "",
          "contact": "0933333333",
          "category": "家人",
          "weddingId": "wedding-001",
          "childChairCount": 0
        }
        """
      And guest-003 has drawn a flower
      When the public requests ViewFlowerField on stream "wedding-001"
      Then the flower field includes:
        """
        {
          "guestId": "guest-003",
          "name": "王志強"
        }
        """
