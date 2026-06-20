import antfu from '@antfu/eslint-config'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  antfu({
    vue: true,
    typescript: true,
    ignores: ['.claude/**', 'spec/**'],
  }),
  // 專案框架慣例（對應 CLAUDE.md，pre-push lint 即可擋下，免 AI）
  {
    files: ['app/**/*.vue', 'app/**/*.ts', 'server/**/*.ts'],
    rules: {
      // 禁止 globalThis.$fetch 繞過型別檢查
      'no-restricted-syntax': ['error', {
        selector: 'MemberExpression[object.name="globalThis"][property.name="$fetch"]',
        message: '禁止 globalThis.$fetch 繞過型別檢查，改用 typed $fetch',
      }],
      // 解構響應式 props 會丟失響應性
      'vue/no-setup-props-reactivity-loss': 'error',
    },
  },
)
