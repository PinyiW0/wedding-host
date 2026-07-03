# language: en
# 手動撰寫（批次 4 新功能，本 repo 無 codegen，直接以此為來源）

Feature: 新增流程角色
  新人自訂當天流程表的參與/負責角色（預設 seed：接待、總場控、新秘、平面攝影師）

  @happy-path @happy-path
  Rule: 成功新增流程角色
    新人成功新增一個自訂角色

    Scenario: 成功新增流程角色
      新人新增「動態攝影」角色
      Given no prior events
      When Admin sends AddRundownRole on stream "role-101":
        """
        {
          "weddingId": "wedding-001",
          "name": "動態攝影"
        }
        """
      Then the RundownRoleAdded event is emitted with:
        """
        {
          "weddingId": "wedding-001",
          "name": "動態攝影"
        }
        """

  Rule: 角色名稱重複時新增失敗
    同一婚禮內角色名稱不可重複

    Scenario: 新增重複名稱的角色
      Given the RundownRoleAdded event has occurred on stream "role-001":
        """
        {
          "weddingId": "wedding-001",
          "name": "接待"
        }
        """
      When Admin sends AddRundownRole on stream "role-102":
        """
        {
          "weddingId": "wedding-001",
          "name": "接待"
        }
        """
      Then the command is rejected with error "角色名稱已存在"
