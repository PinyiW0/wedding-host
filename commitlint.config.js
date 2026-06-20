// Commitlint 設定：強制 Conventional Commits v1.0.0
// 由 .husky/commit-msg 在每次 commit 時驗證；與 /commit skill（生成端）互補——
// skill 負責產出漂亮訊息，commitlint 負責機械擋下不合規的（含手動 commit 繞過 skill 的情況）。
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 收緊主旨長度到 72（preset 預設 100 過寬），對齊經典 50/72 慣例
    'header-max-length': [2, 'always', 72],
  },
}
