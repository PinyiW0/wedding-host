# language: en
# 手動撰寫（批次 3 新功能）

Feature: 推到投影幕
  管理員將已通過審核的祝福推到投影即時牆（標記已上牆，避免重播）

  @happy-path @happy-path
  Rule: 成功推到投影幕
    已通過審核的祝福可推到投影幕

    Scenario: 推到投影幕
      祝福已通過審核，管理員推到投影幕
      Given the BlessingSubmitted event has occurred on stream "blessing-001":
        """
        {
          "guestId": "guest-001",
          "message": "祝福新人百年好合！",
          "weddingId": "wedding-001"
        }
        """
      And the BlessingApproved event has occurred on stream "blessing-001":
        """
        {
          "status": "approved"
        }
        """
      When Admin sends ProjectBlessing on stream "blessing-001":
        """
        {}
        """
      Then the BlessingProjected event is emitted with:
        """
        {
          "blessingId": "blessing-001",
          "wallStatus": "on_wall"
        }
        """

  @condition @not-approved
  Rule: 祝福尚未通過審核
    未通過審核的祝福不可推到投影幕

    Scenario: 祝福尚未通過審核
      祝福仍待審，推到投影幕失敗
      Given the BlessingSubmitted event has occurred on stream "blessing-001":
        """
        {
          "guestId": "guest-001",
          "message": "祝福新人百年好合！",
          "weddingId": "wedding-001"
        }
        """
      When Admin sends ProjectBlessing on stream "blessing-001":
        """
        {}
        """
      Then the operation fails with: 祝福尚未通過審核

  @not-found @blessing-not-found
  Rule: 祝福不存在
    指定祝福不存在時拒絕操作

    Scenario: 祝福不存在
      該祝福不存在
      Given no prior events
      When Admin sends ProjectBlessing on stream "blessing-999":
        """
        {}
        """
      Then the operation fails with: 祝福不存在
