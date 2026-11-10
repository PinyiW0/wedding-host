# Skill 撰寫指南

SKILL.md 五個判準的實作細節。

## 目錄

- [frontmatter 欄位速查](#frontmatter-欄位速查)
- [description 正反例與觸發除錯](#description-正反例與觸發除錯)
- [分層載入的實務細節](#分層載入的實務細節)
- [消費點驗證](#消費點驗證)
- [過度設計長什麼樣](#過度設計長什麼樣)

---

## frontmatter 欄位速查

> 對官方文件驗證於 **2026-08-20**（來源：code.claude.com/docs/en/skills、platform.claude.com 的 agent-skills best-practices 與 skills-guide）。
> 欄位會隨版本增減，超過半年沒驗過就別再信這張表，直接查上面兩個來源。

只有 `name` 與 `description` 是常態需要寫的，其餘按需使用：

| 欄位 | 用途 | 預設 |
|---|---|---|
| `name` | skill 名稱 | 目錄名 |
| `description` | 觸發判斷依據 | 內文第一段 |
| `when_to_use` | 補充觸發情境，接在 description 後 | 無 |
| `argument-hint` | 自動完成時顯示的參數提示 | 無 |
| `arguments` | 宣告具名參數，供內文用 `$名稱` 代入 | 無 |
| `disable-model-invocation` | `true`＝**阻止**模型自動載入（只能手動叫） | `false` |
| `user-invocable` | `false`＝從 `/` 選單隱藏，只有模型能叫 | `true` |
| `allowed-tools` | 清單內工具在本回合免權限詢問（**預先核准，不是限制**） | 無 |
| `disallowed-tools` | 執行期間移除指定工具（這個才是限制） | 無 |
| `context` | 設 `fork` 則在獨立 subagent context 執行 | inline |
| `agent` | 搭配 `context: fork`，指定 subagent 類型 | `general-purpose` |
| `background` | 搭配 `fork`；`false` 則等結果而非背景跑 | `true` |
| `model` / `effort` | 覆寫本次調用的模型與 effort，不寫回設定 | 繼承 |
| `paths` | glob，只在符合路徑的情境才自動載入 | 無 |
| `hooks` | skill 調用時註冊、之後整個 session 持續 | 無 |

字串替換：`$ARGUMENTS`（全部參數）、`$0`／`$1`（第 N 個）、`${CLAUDE_SESSION_ID}`、`${CLAUDE_SKILL_DIR}`、`${CLAUDE_PROJECT_DIR}`。
動態注入：內文寫 <code>!\`指令\`</code> 會在送給模型前先執行並帶入輸出。

### 三個會踩的坑

1. **`disable-model-invocation` 的方向容易搞反**：欄位名是「停用」，`true` 代表關掉自動觸發。想讓 skill 只能手動叫才寫 `true`；預設是 `false`（會自動觸發）。
2. **`allowed-tools` 不是白名單限制**：它的作用是「這些工具本回合不用再問你」。要真正拿掉工具用 `disallowed-tools`。
3. **動態注入的指令不會跳權限詢問**：沒被既有規則或 `allowed-tools` 核准的話，整次 skill 調用直接中止。用 <code>!\`指令\`</code> 時要一併把指令加進 `allowed-tools`。

### name 與 description 的硬限制（一律適用）

`name` ≤64 字元、小寫字母數字連字號、不可含 `anthropic` 或 `claude`；`description` 不可空、≤1024 字元、須用第三人稱寫（「處理 Excel 檔案……」而非「我可以幫你……」）。

這組限制由標準層驗證，超過就打包失敗。**即使 skill 只在本專案內部用也照著寫**——成本是零，而哪天要分享時不必回頭改；何況 1024 字元的 description 早就遠超過「能被準確觸發」的合理長度了。

### 可攜性：只有欄位集合要取捨

跨工具的 Agent Skills 標準只認 `name`、`description`、`license`、`compatibility`、`metadata`、`allowed-tools` 六個欄位。上表其餘欄位都是 Claude Code 專屬擴充——只在 Claude Code 生效，打包上傳到 claude.ai／Skills API 會因未知欄位直接報錯。

要不要收斂到那六個，看 skill 給誰用：只在本專案跑就放心用擴充欄位，要對外分享才需要取捨。這是**欄位集合**的選擇，跟上面那組硬限制無關——硬限制沒有本地例外。

---

## description 正反例與觸發除錯

description 是唯一影響「要不要載入」的欄位，所有「什麼時候該用」的資訊都必須寫在這裡——寫在 body 裡等於沒寫，因為 body 是觸發後才載入的。

### 正反例

```
✅ 根據 .feature 規格檔產出 Playwright E2E 測試，涵蓋 fixtures、selectors 與 spec 檔。
   Use when 使用者提到「寫測試」「E2E」「Playwright」，或提供 .feature 檔案時。

✅ 載入 NuxtUI 官方文檔，用於查詢元件 API、Props 與使用範例。
   Use when 使用者問到 UTable、UModal 等 Nuxt UI 元件用法，或需要查元件屬性時。

❌ 幫助撰寫前端測試。
   → 什麼框架？什麼層級？使用者要說什麼才算命中？

❌ 處理 Playwright 的 Page 物件。
   → 太技術，沒有使用者會這樣講；描述的是實作不是情境
```

差別在於：好的 description 讀起來像 if-then 條件（看到這些訊號就啟動），壞的讀起來像功能簡介。

### 觸發除錯

| 症狀 | 原因 | 解法 |
|---|---|---|
| 說了相關的話卻沒啟動 | description 太空泛，缺具體觸發詞 | 補使用者實際會講的字眼與檔案類型 |
| 不相關的對話也啟動 | 觸發詞過寬 | 加負面觸發詞，明說不適用的場景 |
| 該用 A skill 卻載入 B | 兩者 description 重疊 | 把差異寫進各自的 Use when，講清楚分工 |

---

## 分層載入的實務細節

三層的意義是 context 管理，不只是檔案整理：frontmatter 永遠佔著 context，body 觸發才進來，references 用到才讀。所以**把東西放在哪一層，等於決定它要花多少人的多少 context**。

### 什麼該往下放

- 只有部分情境會用到的細節（特定子流程、罕見分支）→ references/
- 大量對照資料（欄位表、錯誤碼、schema）→ references/，按主題分檔，不要一檔塞全部
- 可執行的邏輯 → scripts/，用執行的不用讀的（原始碼不進 context，只有輸出進）
- 模板、圖片、字型等產出用素材 → assets/

### 硬規則與理由

- **references 只有一層**：全部從 SKILL.md 直連，reference 之間不互相引用。巢狀時模型常只預覽開頭幾十行就繼續，讀不到後面的內容
- **超過 100 行的 reference 加目錄**：理由同上，預覽時至少看得到全貌
- **放進 references/ 的檔案、scripts/ 的每個子命令都要在 SKILL.md 有呼叫或連結點**：沒有的話模型不知道它存在，而且不會報錯——寫了、看起來完整，但永遠不會被執行。詳見下方「消費點驗證」
- **不寫 README.md／CHANGELOG.md**：skill 是給模型讀的，不是給人瀏覽的

### 資料型 reference 要標來源與鮮度

上一節說對照資料該放 references/，但這類資料會過期，而模型讀到時無從分辨新舊。所以檔案開頭要標「取自哪裡、驗證於哪一天」，並寫明過期後該去哪裡重查——本檔的 frontmatter 速查就是這樣做的。

其中**沒查證到的條目要當場標示**（例如「後端實際回傳字串未覆核」），不要讓推測的內容混在已驗證的資料裡看起來一樣可信。模型會照著用，錯的資料比沒有資料更糟。

---

## 消費點驗證

`scripts/` 的每個子命令、`references/` 的每份檔案，都要能在 SKILL.md 指出呼叫或載入的位置——指不出來就是死碼：寫了、看起來完整，但永遠不會被執行，而且不報錯，只會靜默不作用。

（2026-08-20 開發 `/ship` skill 時踩過三次：`scripts/ledger.sh` 的 `mark`、`l2`、`fp` 三個子命令都沒被 SKILL.md 呼叫到，去重機制整個沒發生，ledger 永遠只有兩行 header；兩輪對抗式審查都沒抓到——審查者在讀文件，不是在用工具。）

### 機械判準

對每個子命令、每個檔名，在 SKILL.md 裡能 grep 到才算有消費點：

```
grep -n "<子命令名或檔名>" SKILL.md
```

抓不到任何一行，就代表沒有呼叫或連結點。

### 指不出消費點時的兩種處置

- **補呼叫點**：這段邏輯還需要，在 SKILL.md 明確寫出「什麼情境下呼叫哪個子命令／讀哪份檔案」
- **刪除死碼**：這段邏輯其實不需要，直接刪掉該子命令或檔案

兩種都行，**不允許放著不管**——放著就是下一次踩雷的起點，而且下次未必有人發現。

### 正反例

```
❌ 死碼：scripts/ledger.sh 有 mark 子命令，SKILL.md 全文沒出現「mark」
   → grep -n "mark" SKILL.md 抓不到任何一行，模型永遠不會呼叫它，
     去重機制看起來存在、實際上從沒發生過

✅ 有消費點：SKILL.md 寫「跑完某層立刻執行
   `ledger.sh mark <layer> <status> <fp>` 記錄本輪結果，
   下一輪同指紋就沿用綠燈、不重跑」
   → grep -n "mark" SKILL.md 能對到這行，呼叫時機與參數都寫清楚
```

---

## 過度設計長什麼樣

優化既有 skill 時，這些是高頻的過度設計徵狀。看到不代表一定要砍，但要能講出它擋掉了什麼具體錯誤——講不出來就是儀式。

| 徵狀 | 為什麼是問題 |
|---|---|
| 每個檔案開頭都有一份 contract 區塊，內容是 `input: text, output: text` | 零資訊。模型之間傳遞不需要形式化 schema |
| 線性流程圖（A → B → C，無分支） | 用一句話講完的事畫成圖，讀圖成本高於讀句子。有分支才值得畫 |
| 「做完第一步後進入第二步」這類段落 | 同義反覆，順序已經由文件順序表達了 |
| 把設計決策做成選單問使用者（「要幾個階段？2/3/4」） | 先定殼再填肉，設計被外包出去，且殼會反過來限制內容 |
| 每個階段都有確認點 | 打斷流程。確認點要能回答「不問會怎樣」，答不出來就拿掉 |
| 教模型呼叫工具、教 Markdown 語法、教通用最佳實踐 | 模型已經會，純消耗 context |
| 逐字比對式的判準（「必須包含某某字串」） | 換個寫法就誤判。改成語意判準：「說明了做什麼與何時用」 |
| 整份文件到處 CRITICAL／MUST／全大寫 | 全部都重要等於都不重要，模型無從分辨真正的紅線 |
| 檢查清單全是格式項（有沒有流程圖、編號連不連續） | 格式合規不等於品質，通過檢查的 skill 仍可能整體是過度設計 |

一個判斷句：**這段文字擋掉的是「模型會犯的錯」，還是「模型不照我的格式走」？** 後者多半可以刪。

這張表只管敘事層——文字該不該留。範例程式碼有沒有 bug、檔案之間會不會互相矛盾、自我註記過不過期，都不會在這裡現形，要照 SKILL.md「優化既有 skill」的後三條另外查。

用這個判斷句時要逐條看，不要靠數的。密度統計（數幾個「必須」、幾個驚嘆號）只能挑出值得細看的檔案——高密度檔案裡的條目往往每條都帶著實戰理由，屬低容錯的必要規範，統計數字直接當判決就會誤殺。
