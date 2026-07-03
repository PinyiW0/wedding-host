# language: en
# 手動撰寫（批次 4 迭代）：流程表改為矩陣表（列＝時間段、固定欄＋每角色一欄），表格內編輯、單一儲存鈕整表 PUT

Feature: 儲存流程矩陣表
  新人於矩陣表內直接編輯當天流程（開始時間、時長、主要事項、場地、物品、備註、各角色個別事項），
  按單一儲存鈕整表送出。整表取代語意：既有列帶 rundownItemId 沿用、新列省略（後端配發）、未帶回的既有列＝刪除。
  time 可為 null＝未定時段（如「婚前一天」準備列，排序置頂）。

  @happy-path
  Rule: 成功儲存流程矩陣表
    整表取代：既有列改內容、新列配發 id、未帶回列刪除

    Scenario: 成功儲存流程矩陣表
      Given the RundownRoleAdded event has occurred on stream "role-003":
        """
        {
          "weddingId": "wedding-001",
          "name": "新秘"
        }
        """
      When Admin sends SaveRundownTable on stream "wedding-001":
        """
        {
          "items": [
            {
              "rundownItemId": "rundownitem-001",
              "time": "16:30",
              "durationMinutes": 20,
              "title": "新娘物品點交",
              "location": "新娘房",
              "roleTasks": [{ "roleId": "role-003", "task": "婚紗配件、備用鞋檢查" }]
            },
            {
              "time": "17:30",
              "durationMinutes": 20,
              "title": "婚宴場地佈置確認",
              "location": "宴會廳"
            }
          ]
        }
        """
      Then the RundownTableSaved event is emitted with:
        """
        {
          "weddingId": "wedding-001",
          "itemCount": 2
        }
        """

  Rule: 時間格式錯誤時儲存失敗
    列的 time 若有填必須為 HH:MM（空/null 允許＝未定時段）

    Scenario: 時間格式錯誤
      Given no prior events
      When Admin sends SaveRundownTable on stream "wedding-001":
        """
        {
          "items": [{ "title": "測試項目", "time": "五點" }]
        }
        """
      Then the command is rejected with error "時間格式錯誤"
