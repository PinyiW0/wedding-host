# Copilot reviewer 的 login 白名單。copilot.sh、copilot-metrics.sh、copilot-harvest.sh 都用 `.` 讀這一份，
# SKILL.md 鐵律 2 也指向這裡——要改白名單只改這個檔。
#
# 同一個 bot 在三個端點的三種 login（實測 2026-09-02）：
#   GraphQL review author      → copilot-pull-request-reviewer
#   REST /pulls/N/reviews      → copilot-pull-request-reviewer[bot]
#   REST /pulls/N/comments     → Copilot
# 比對一律「type 是 Bot ＋ login 在白名單內（大小寫須完全相同）」，不用 contains／正則：
# contains("copilot") 或 test("copilot.*review") 都會撈到 copilot-swe-agent(-review) 這類另一個 bot。
COPILOT_LOGINS='["Copilot","copilot-pull-request-reviewer","copilot-pull-request-reviewer[bot]"]'
