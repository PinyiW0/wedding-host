// 影片連結解析：YouTube 連結轉 embed URL（自動播放/靜音/循環），其餘回 null 交給 <video>

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/

export function toYouTubeEmbed(url: string): string | null {
  const id = url.match(YT_RE)?.[1]
  return id
    ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&rel=0`
    : null
}
