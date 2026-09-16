// app/composables/usePublicWeddingGuard.ts — 公開三頁（故事、喜帖、相簿）的婚禮 ID 守門。
// 這三頁的內容是寫死的、屬於新人自己那一場（useStoryContent／useGalleryContent／useInviteScene），
// 網址上的 weddingId 只拿來拼出席回覆的連結，頁面本身不會依 ID 換內容。
// 沒有這道門，任何 ID 都會打開同一份故事：別場婚禮的賓客改網址就看得到，回覆鈕還指到他們那場。
// 綁哪一場由 runtimeConfig.public.landingWeddingId 決定：正式 build 預設新人那場，dev／gate 留空＝全部放行。
// 以後要做成給其他新人用的模板，把這裡改成依 weddingId 查表（issue #158 範圍外）。

/** 網址上的婚禮 ID 不是設定綁定的那一場時丟 404；設定留空則不擋 */
export function usePublicWeddingGuard(weddingId: string): void {
  const { landingWeddingId } = useRuntimeConfig().public
  if (landingWeddingId && weddingId !== landingWeddingId) {
    throw createError({
      statusCode: 404,
      statusMessage: '找不到這場婚禮',
      fatal: true,
    })
  }
}
