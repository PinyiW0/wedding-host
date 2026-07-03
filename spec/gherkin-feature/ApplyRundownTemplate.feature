# language: en
# 手動撰寫（批次 4 迭代）：範本改為前端帶入草稿——不再有 apply-template 後端命令，
# 帶入僅產生草稿列（modal 可預覽推算結果），最終以 SaveRundownTable 整表儲存

Feature: 帶入宴客段流程範本
  新人以開始時間錨定，於前端一鍵帶入宴客段標準流程草稿（8 段）；
  各段時間依推算公式凍結：第一段＝startTime，第 n 段＝前段起始＋前段時長；
  帶入後可於矩陣表自由增刪改，再以 SaveRundownTable 儲存

  @happy-path
  Rule: 成功帶入宴客段範本並儲存
    以 18:00 起算帶入 8 段草稿（18:00 彩排 15 分 → 18:15 迎賓收禮金 30 分 → … → 21:05 送客合照），
    儲存時隨 SaveRundownTable 整表送出

    Scenario: 成功帶入宴客段範本並儲存
      預設角色（接待/總場控/新秘/平面攝影師）已存在
      Given the RundownRoleAdded events have occurred for the default roles of "wedding-001"
      When Admin previews the template with start time "18:00"
      Then the preview shows:
        """
        { "title": "彩排・設備確認", "start": "18:00" }
        """
      And the preview shows:
        """
        { "title": "送客・合照", "start": "21:05" }
        """
      When Admin applies the template into the draft and sends SaveRundownTable on stream "wedding-001"
      Then the RundownTableSaved event is emitted including an item:
        """
        {
          "time": "18:00",
          "title": "彩排・設備確認"
        }
        """
      And the RundownTableSaved event is emitted including an item:
        """
        {
          "time": "21:05",
          "title": "送客・合照"
        }
        """
