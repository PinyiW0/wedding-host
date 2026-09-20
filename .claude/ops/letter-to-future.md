# 給未來 session 的信

> 寫於 2026-07-05，Fable 5 session（issue #45）。你（讀者）多半是較便宜的模型——這封信講的是檔案裡沒有、但你該知道的事。

## 一、三件沒被問到、但最重要的事

**1. 全域層有壞路由，本制度管不到，要使用者手動處理。**
`~/.claude/CLAUDE.md` 引用 `~/.claude/rules/vue.md`、`nuxt.md`、`vitest.md`，三檔皆不存在（2026-07-05 實測）。每個 session（所有專案）都載著指向空氣的指令。我依授權範圍（制度檔全放本專案）沒有動它——**請提醒使用者**：把那三行引用刪掉，或把規則檔真的建出來。

**2. 這套制度的生效邊界是「本專案」。**
記憶與制度檔都按專案路徑隔離；使用者機器上另有 6 個專案目錄完全吃不到這套制度。這是使用者自選的取捨（進版控、可 PR、隨模板複製）。若你在別的專案被問到「為什麼沒有制度」——答案是複製 `.claude/ops/` 過去，或提議升級到 `~/.claude/` 全域層。

**3. 「先草案 → 等確認 → 才執行」鐵律是本專案 skill 的防彈設計，別在優化時拆掉。**
未來若有人（包括你）覺得流程太囉嗦、想讓 skill「更自動」，記住：這條鐵律擋掉的是「AI 先斬後奏」這一整類事故。效率要從調度省（粗活派便宜模型），不是從確認省。

## 二、制度最可能的退化方式與預防

| 退化方式 | 徵兆 | 預防 |
|----------|------|------|
| 制度檔沒人讀 | session 裡從沒出現對 ops/ 的引用 | CLAUDE.md 內嵌三原則 digest（已做）；使用者發現 AI 行為退回老樣子時，直接說「照 ops/ 制度做」 |
| 參數腐化 | harness 更新後，model 名／參數與檔案裡的不符 | 檔案裡所有參數都標了查證日期；不符時依 [maintenance.md](maintenance.md) 第 5 節重新查證更新，**不憑記憶填** |
| 例外累積 | 「這次特殊」的繞過越來越多 | 繞過必須在回報／PR 中明說；[judgment-rubrics.md](judgment-rubrics.md) 第 4 節把「想繞過」定義為方向錯誤的訊號 |
| 索引膨脹回內容型 | CLAUDE.md 又開始塞長段落 | 行數上限 150 + maintenance 第 3 節的行數檢查 |

## 三、誠實聲明：信心最低的產出與原因

1. **升降級路徑的具體數字**（錯 1 次升級、同任務 2 輪上限）——是合理判斷值，不是實證數據。用幾輪後若發現太嚴或太鬆，直接改 [model-dispatch.md](model-dispatch.md) 並記錄理由。
2. **model 對照表的任務分派**——「sonnet 做實作夠用」基於一般經驗，未在本專案 A/B 實測。本專案有 dogfood 傳統：拿真實任務／真實 spec 跑過再校準，別只信自製案例（教訓原文在使用者層記憶，不隨 repo）。
3. **新增 rules 檔的 paths 觸發未實測**——`vibe-ui.md`、`frozen-paths.md`、`framework-skills.md` 是照專案既有 rules 的 frontmatter 慣例寫的，但「碰到對應路徑時真的會自動載入」這件事 read-back 驗不了，只能等實際 session 碰到才知道。**下次改 UI 檔時請觀察守則是否自動出現**；沒出現就是消費點斷了，把內容併回 `ui-conventions.md`（它已被驗證會觸發）。
4. **「被導向 Opus 4.8 的請求是否消耗本窗口額度」——完全未確認**。harness 不暴露計費資訊。建議使用者到 usage 儀表板實測後，把答案補進這份檔案。
5. **Agent tool 無 effort 參數**是 2026-07-05 的 tool schema 事實；harness 隨時可能加上。健檢時重查。

## 四、接手大任務前的 checklist

1. 讀 `.claude/CLAUDE.md`（自動載入）＋這封信
2. 開工前照 [model-dispatch.md](model-dispatch.md) 分派；拿不定主意查 [judgment-rubrics.md](judgment-rubrics.md)
3. 隨做隨存——你隨時可能被 compact，存了檔的才是全部（判準見 [model-dispatch.md](model-dispatch.md) 第 7 節）
4. 完成前跑 [maintenance.md](maintenance.md) 第 3 節路由驗證
