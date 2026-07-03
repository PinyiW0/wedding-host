# language: en
# 手動撰寫（批次 4 新功能，本 repo 無 codegen，直接以此為來源）

Feature: 更新流程角色
  新人為自訂角色改名

  @happy-path @happy-path
  Rule: 成功更新流程角色
    新人成功將角色改名

    Scenario: 成功更新流程角色
      Given the RundownRoleAdded event has occurred on stream "role-004":
        """
        {
          "weddingId": "wedding-001",
          "name": "平面攝影師"
        }
        """
      When Admin sends UpdateRundownRole on stream "role-004":
        """
        {
          "name": "平面攝影"
        }
        """
      Then the RundownRoleUpdated event is emitted with:
        """
        {
          "roleId": "role-004",
          "name": "平面攝影"
        }
        """

  Rule: 角色不存在時更新失敗

    Scenario: 更新不存在的流程角色
      Given no prior events
      When Admin sends UpdateRundownRole on stream "role-999":
        """
        {
          "name": "新名稱"
        }
        """
      Then the command is rejected with error "流程角色不存在"
