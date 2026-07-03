# language: en
# 手動撰寫（批次 4 迭代）：矩陣化後公開頁補場地與角色個別事項可讀；?role= 改以 roleTasks 過濾

Feature: 公開流程表
  工作人員（非系統帳號）透過免登入唯讀連結查看當天流程；
  每個時段可讀到時間、主要事項、場地與各角色的個別事項；
  可帶角色參數只看該角色參與的時段（roleTasks 含該角色）

  @happy-path
  Rule: 成功呈現公開流程表
    婚禮存在時回所有流程項目（time null 置頂，其餘依時間排序），含場地與角色個別事項

    Scenario: 呈現公開流程表
      Given the RundownTableSaved event has occurred on stream "wedding-001" including an item:
        """
        {
          "rundownItemId": "rundownitem-001",
          "time": "16:30",
          "title": "新娘物品點交",
          "location": "新娘房",
          "roleTasks": [{ "roleId": "role-003", "task": "婚紗配件、備用鞋檢查" }]
        }
        """
      When the public requests ViewPublicRundown on stream "wedding-001"
      Then the rundown view includes:
        """
        {
          "rundownItemId": "rundownitem-001",
          "time": "16:30",
          "title": "新娘物品點交",
          "location": "新娘房"
        }
        """
      And the item's role tasks are readable:
        """
        [{ "roleId": "role-003", "task": "婚紗配件、備用鞋檢查" }]
        """

  Rule: 依角色參數篩選
    帶角色參數時，只呈現 roleTasks 含該角色的時段，並顯示該角色的個別事項

    Scenario: 依角色篩選公開流程表
      Given the RundownTableSaved event has occurred on stream "wedding-001" including an item:
        """
        {
          "title": "新娘物品點交",
          "roleTasks": [{ "roleId": "role-003", "task": "婚紗配件、備用鞋檢查" }]
        }
        """
      And including an item:
        """
        {
          "title": "禮金桌準備",
          "roleTasks": [{ "roleId": "role-001", "task": "禮金點收" }]
        }
        """
      When the public requests ViewPublicRundown on stream "wedding-001" with role "role-003"
      Then the rundown view includes only items whose roleTasks reference "role-003"
      And the view shows the task "婚紗配件、備用鞋檢查" for that role
