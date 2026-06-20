# **（專案名稱）**

## 專案資訊

### 資源
- 流程圖： （流程圖連結）
- 設計稿： （設計稿連結）
- 後端文件： （後端文件連結）
- Slack： （Slack 連結）
- Asana： （Asana 連結）

### 環境
- node 版本 : `22.22.0`
- 編輯器 : `VSCode`

### VSCode 套件
- [VS Code](https://code.visualstudio.com/)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
- [Vue 3 Snippets](https://marketplace.visualstudio.com/items?itemName=hollowtree.vue-snippets)
- [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Goto definition alias](https://marketplace.visualstudio.com/items?itemName=antfu.goto-alias)
- [i18n Ally](https://marketplace.cursorapi.com/items/?itemName=lokalise.i18n-ally)

### 啟動指令
```
npm install // 安裝套件
npm run customize // 客製化專案設定
npm run dev // 啟動專案
npm run build // 使用 CSR 或 SSR 模式打包專案
npm run generate // 使用 SSG 模式打包專案
npm run preview // 啟動打包後專案
npm run eslint // 檢查 eslint 規則
npm run typelint // 檢查 typelint 規則
```

## 專案建立步驟

### GitHub 設定
- General
  - Pull Requests
    - Allow squash merging : `Default to pull request title and commit details`

### 開發步驟
- 建立 `feature/#1-basic` 分支
  - 執行 `npm run customize` 進行專案客製化設定或手動執行以下步驟
    - package.json
      - name : `${GitHub 專案名稱}`
    - README.md
      - 填寫專案名稱及專案資訊
    - Slack 綁定
      - 在 `#team-front-end-develop` 群組中輸入 `/github subscribe ${owner}/${repo}` 即可將進行綁定，未來群組成員可以收到 `issues`, `pulls`, `commits`, `releases`, `deployments` 相關的訊息。
      - 若專案結束，輸入 `/github unsubscribe ${owner}/${repo}` 即可解除綁定。
      - 若要綁定其他 Slack 群組，需要在該群組選項 `Integrations/Apps` 中新增 `Github`，並重複以上操作即可。
  - Azure Blob Website 自動部署功能（可選）
    - 執行 `npm run customize:blob` 進行自動部署設定
    - Azure Storage Account 設定
      - 請先自行在指定 resource group 底下開設 storage account，並且設置 static website active
      - 確認 resource group 位置後，需要向 resource group 權限管理者去索取一個 JSON 檔來進行 RBAC
      ([reference](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-static-site-github-actions?tabs=userlevel#generate-deployment-credentials))
    - GitHub Repo 設定
      - 移動至 `Settings > Security > Secrets and variables > Actions > Repository secrets` 將上述 JSON 檔貼上，並取變數名為 `AZURE_CREDENTIALS` (Beta 為 `AZURE_CREDENTIALS_BETA`)
      - 移動至 `Settings > Security > Secrets and variables > Actions > Repository variables` 將 Azure storage account name 貼上，並取變數名為 `ACCOUNT_NAME`（Beta 為 `ACCOUNT_NAME_BETA`）

- 建立 `feature/#2-design` 分支（設計稿完成）
  - assets/icons
    - 下載設計稿圖示包
    - [Nuxt Icon 參考文件](https://hackmd.io/Swod3KqJTgass8l9-eJ2FQ?view)
  - tailwind.config.ts
    - 設定設計稿變數
  - components
    - 根據設計稿拆分共用組件
    - 建立 `components` 檔案並備註組件內容
  - layouts
    - 根據設計稿圖規劃專案佈局
    - 建立 `layouts` 檔案並備註佈局內容
  - pages
    - 根據設計稿圖規劃頁面流程
    - 建立 `pages` 檔案並備註頁面內容
- 建立 `feature/#3-api` 分支（後端文件完成）
  - apis（待討論）
    - 根據後端文件建立 API 型別
    - 根據後端文件進行串接及業務邏輯封裝

## 開發規範

### 框架
- Nuxt 4 + Composition API + `<script setup lang="ts">`
- TypeScript
- Nuxt UI
- Nuxt CLI

### 套件
- [pinia](https://pinia.vuejs.org/)
- [VueUse](https://vueuse.org/)

### 規範
- [ESLint Standard](https://standardjs.com/readme-zhtw.html)
- [ESLint Tailwind](https://github.com/francoismassart/eslint-plugin-tailwindcss)
- [ESLint Vue3](https://eslint.vuejs.org/rules/)
- [ESLint Nuxt3](https://github.com/nuxt/eslint-plugin-nuxt)
- [commitlint](https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional)
- [Nuxt 4 架構參考](https://nuxt.com/docs/guide/directory-structure/app)

## GitHub 流程

### 流程
- 預設使用 `GitHub Flow` 流程
- main：主要分支（開發環境）
- tag：部署版本（正式環境）
- 多環境情境
  - 建立其他分支代表特定環境（ex. 建立 produciton 分支代表正式環境）
  - 若需進行更新
    - 使用 `git merge main --no-ff` 的方式合併 main 分支改動
- 多版本維護情境
  - 建立 `release/${主版號}.${次版號}` 分支維護單一版本
  - 若需進行更新（適用所有版本）
    - 建立分支並合併至 main
    - 使用 `git cherry-pick` 的方式從 main 分支更新改動
  - 若需進行更新（僅適用此版本）
    - 建立分支並合併至 release

### Issues
- 填寫標題、說明和標籤類型
- 指派至少一名負責人
- 建立分支
  - 右下角點擊 `Create a branch`
  - Main 分支改動 : `feature/#${issue_number}-${description}`
  - 特定 Release 分支改動 : `feature/${主版號}.${次版號}-#${issue_number}-${description}`

### Commits
- 只開發對應 Issue 的內容，不相關的內容請另開 Issue
- 複雜邏輯應適當註解
- 定期同步主分支
  - Main 分支為主分支 : `git merge main --no-ff`
  - 特定 Release 分支為主分支 : `git merge release/${主版號}.${次版號} --no-ff`
- 通過 `commitlint` 檢查

### Pull Requests
- Author
  - 標題、功能說明和標籤類型填寫正確且清楚
  - 通過 CI 檢查
  - 填寫測試清單
  - 指派至少一名 Code Review 負責人
- Reviewer
  - 確認標題、功能說明和標籤類型填寫符合對應 Issue
  - 確認目標合併分支正確
  - 進行 Code Review 確認是否符合開發規範
  - 確認通過測試清單
  - 使用 `Squash and Merge` 模式合併
  - 確認通過 CI/CD 且成功合併及部署

### Releases
- Choose a tag
  - 版本號 : `v${主版號}.${次版號}.${修訂號}-${測試環境}.${測試版號}`
    - 主版號 : 不可相容的功能新增或修改
    - 次版號 : 可相容的功能新增或修改
    - 修訂號 : 可相容的功能問題修復
    - 測試環境（選填）: alpha (內部)、beta (外部)
    - 測試版號（選填）: 內部或外部測版號
- Target
  - 選擇 `main` 或 `release`
- 填寫標題及改動說明
  - 可點擊 `Generate release notes` 自動產生
