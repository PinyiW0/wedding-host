# Claude Code Skill 官方規格

> 來源：[Claude Code Skills 官方文件](https://code.claude.com/docs/en/skills)

---

## 1. Frontmatter

```yaml
---
name: my-skill
description: |
  做什麼。Use when 觸發情境。
argument-hint: '[param]'
disable-model-invocation: true
user-invocable: false
allowed-tools: Read, Grep, Glob
context: fork
agent: Explore
model: sonnet
hooks:
  pre-invoke: ./scripts/setup.sh
---
```

### 欄位說明

| 欄位 | 必要 | 說明 | 預設 |
|------|------|------|------|
| `name` | 否 | Skill 名稱（小寫+連字號，≤64 字元）| 目錄名稱 |
| `description` | 建議 | 觸發描述（**Claude 用來判斷何時載入**）| 第一段內容 |
| `argument-hint` | 否 | 自動完成時顯示的參數提示 | - |
| `disable-model-invocation` | 是 | 允許 Claude 自動載入 | true |
| `user-invocable` | 否 | 允許用戶手動調用 | true |
| `allowed-tools` | 否 | 限制可用工具 | 全部 |
| `context` | 否 | 執行環境（`fork`=獨立子代理）| inline |
| `agent` | 否 | 子代理類型（配合 `context: fork`）| general-purpose |
| `model` | 否 | 指定模型 | 繼承 |
| `hooks` | 否 | Skill 生命週期 hooks | - |

### 檢查規則

| # | 項目 | 通過條件 | 嚴重度 |
|---|------|----------|--------|
| 1.1 | frontmatter 存在 | 有 `---` 區塊 | Critical |
| 1.2 | name 格式 | 小寫+連字號，≤64 字元 | Critical |
| 1.3 | description 存在 | 有 description 欄位 | Critical |

---

## 2. 字串替換

| 變數 | 說明 |
|------|------|
| `$ARGUMENTS` | 調用時傳入的所有參數 |
| `$ARGUMENTS[N]` | 第 N 個參數（0-based）|
| `$N` | `$ARGUMENTS[N]` 的簡寫（如 `$0`, `$1`）|
| `${CLAUDE_SESSION_ID}` | 當前 session ID |

### 動態 Context 注入

`!`command`` 語法在發送給 Claude 前執行 shell 命令：

```markdown
---
name: pr-summary
context: fork
agent: Explore
---

## PR Context
- Diff: !`gh pr diff`
- Comments: !`gh pr view --comments`
```

---

## 3. Description 撰寫

Description 是**唯一影響 Claude 自動觸發**的欄位。

### 公式

```
{能力描述}。Use when {觸發情境}。
```

### 範例

| 類型 | Description |
|------|-------------|
| 參考型 | REST API 設計規範。Use when 撰寫 API 端點、設計介面。|
| 任務型 | 部署應用程式到生產環境。Use when 用戶要求部署、發布、上線。|
| 研究型 | 分析專案依賴。Use when 檢查依賴、審計套件、升級前評估。|
| 協作型 | 協助撰寫功能需求規格。Use when 要寫 spec、PRD、需求文件。|

### 檢查規則

| # | 項目 | 通過條件 | 嚴重度 |
|---|------|----------|--------|
| 2.1 | Use when 格式 | 包含「Use when」| Critical |
| 2.2 | 觸發關鍵字 | Use when 後 ≥2 個觸發詞 | Warning |
| 2.3 | Claude 視角 | 非「幫助用戶」開頭 | Warning |

---

## 4. 目錄結構

```
.claude/skills/{skill-name}/
├── SKILL.md           # 主檔案（必要，≤500 行）
├── references/        # 參考文件（選用）
│   └── *.md
├── examples/          # 範例（選用）
│   └── *.md
└── scripts/           # 腳本（選用）
    └── *.py
```

### 檢查規則

| # | 項目 | 通過條件 | 嚴重度 |
|---|------|----------|--------|
| 3.1 | SKILL.md 存在 | 有 SKILL.md 主檔案 | Critical |
| 3.2 | SKILL.md 行數 | ≤500 行 | Critical |

---

## 5. Skill 存放位置

| 位置 | 路徑 | 適用範圍 |
|------|------|----------|
| Enterprise | 透過 managed settings | 組織內所有用戶 |
| Personal | `~/.claude/skills/<name>/SKILL.md` | 個人所有專案 |
| Project | `.claude/skills/<name>/SKILL.md` | 僅此專案 |

---

## 6. 內容精簡規則

撰寫 Skill 內容時應遵循：

### 檢查規則

| # | 項目 | 通過條件 | 嚴重度 |
|---|------|----------|--------|
| 4.1 | 無重複定義 | 同一概念只定義一次 | Warning |
| 4.2 | 無通用知識 | 無 AI 已知的常識解釋 | Warning |
| 4.3 | 範例集中 | 範例在獨立檔案或專區 | Warning |
| 4.4 | 無視覺提示 | 無 emoji 視覺輔助 | Warning |
