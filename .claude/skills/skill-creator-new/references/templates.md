# Skill 類型骨架

五種常見形狀，**是參考不是分類制度**——真實 skill 常跨兩三種，不必先歸類再填空。挑最接近的骨架起手，然後照 SKILL.md 的五個判準改。

## 目錄

- [知識型](#知識型)：提供慣例、地雷、API 用法
- [任務型](#任務型)：執行有副作用的操作
- [研究型](#研究型)：蒐集、盤點、分析
- [協作型](#協作型)：需要使用者中途做決定
- [背景型](#背景型)：模型該知道、使用者不會主動叫

各型差異主要在 frontmatter 的組合（欄位語意查 authoring-guide 的「frontmatter 欄位速查」）：

| 類型 | 用途 | 誰觸發 | frontmatter 關鍵 |
|---|---|---|---|
| 知識型 | 提供慣例、地雷、API 用法 | 模型自動＋手動 | 預設即可 |
| 任務型 | 執行有副作用的操作 | 手動為主 | `disable-model-invocation: true`、`allowed-tools` |
| 研究型 | 蒐集、盤點、分析 | 自動＋手動 | `context: fork`、`agent` |
| 協作型 | 需要使用者中途做決定 | 手動 | `disable-model-invocation: true` |
| 背景型 | 模型該知道、使用者不會主動叫 | 自動 | `user-invocable: false` |

---

## 知識型

讓模型第一次就寫對——打包它不知道的慣例與地雷。正反例比規則描述有效。

```markdown
---
name: {topic}-conventions
description: |
  {主題}的慣例與常見錯誤。Use when {撰寫／設計／修改} {相關對象}。
---

# {主題}慣例

## 核心原則
{2–4 條，每條一句話}

## 具體規則
{禁止行為 → 正確做法，成對寫}

## 容易踩的坑
{這裡放模型真的不知道的事：版本差異、專案特有限制、看似正確但跑不動的寫法}
```

## 任務型

有副作用的操作。順序錯就出事的部分屬低容錯，把步驟寫死；判斷性的部分留給模型。

```markdown
---
name: {action}-{target}
description: |
  {做什麼}。Use when {使用者會怎麼說}。
disable-model-invocation: true
allowed-tools: {這次流程會反覆用到、不想每次被問的指令；要禁用工具是 disallowed-tools}
---

# {任務名稱}

## 前置檢查
{任一不通過就停下說明，不硬幹——列檢查項與不通過的處置}

## 步驟
{低容錯：寫死順序。高容錯：給判準}

## 完成後
{回報什麼、哪些事刻意不做（例如不自動 commit）}
```

## 研究型

在獨立 context 蒐集資訊，回報結論而非過程。適合放進 fork 避免污染主線 context。

```markdown
---
name: analyze-{target}
description: |
  分析 {目標}。Use when {分析情境}。
context: fork
agent: Explore
---

# {分析任務}

## 要回答的問題
{列成可獨立判定的問題，不要寫「研究一下 X」}

## 回報格式
{結論＋證據（檔案:行號）；查不到要明說，禁止編造}
```

## 協作型

需要使用者中途拍板才能繼續。**確認點越少越好**——每個確認點都要能回答「不問會怎樣」，答不出來就別問。

```markdown
---
name: {process}-{output}
description: |
  {做什麼}。Use when {觸發情境}。
disable-model-invocation: true
---

# {流程名稱}

## 流程
{一段話講完整體走向，讓模型先有全貌}

## {階段一}
{做什麼；需要使用者決定的地方用 AskUserQuestion，選項給具體猜測而非抽象分類}

## {階段二}
{...}
```

## 背景型

模型需要知道、但使用者不會主動呼叫的脈絡。典型是「為什麼這裡長這樣」。

```markdown
---
name: {topic}-context
description: |
  {主題}的背景與現況。Use when {相關情境}。
user-invocable: false
---

# {主題}背景

## 為什麼會變成這樣
{歷史決策與其理由——這是模型從程式碼看不出來的部分}

## 現在的狀態
{...}

## 動這塊之前要知道的事
{...}
```
