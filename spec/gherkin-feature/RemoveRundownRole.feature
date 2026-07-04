# language: en
# 手動撰寫（批次 4 新功能，本 repo 無 codegen，直接以此為來源）

Feature: 移除流程角色
  新人移除自訂角色；已引用該角色的流程項目自動清除該角色（級聯清理）

  @happy-path @happy-path
  Rule: 成功移除流程角色
    新人成功移除角色，項目上的引用一併清除

    Scenario: 成功移除流程角色
      Given the RundownRoleAdded event has occurred on stream "role-004":
        """
        {
          "weddingId": "wedding-001",
          "name": "平面攝影師"
        }
        """
      And the RundownTableSaved event has occurred on stream "wedding-001" including an item:
        """
        {
          "rundownItemId": "rundownitem-001",
          "weddingId": "wedding-001",
          "title": "新娘物品點交",
          "roleTasks": [{ "roleId": "role-004", "task": "側拍" }]
        }
        """
      When Admin sends RemoveRundownRole on stream "role-004":
        """
        {}
        """
      Then the RundownRoleRemoved event is emitted with:
        """
        {
          "roleId": "role-004"
        }
        """
      And the rundown item "rundownitem-001" no longer references "role-004"

  Rule: 角色不存在時移除失敗

    Scenario: 移除不存在的流程角色
      Given no prior events
      When Admin sends RemoveRundownRole on stream "role-999":
        """
        {}
        """
      Then the command is rejected with error "流程角色不存在"
