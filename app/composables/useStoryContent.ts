// 公開婚禮故事首頁（/story/[weddingId]）的靜態內容（issue #158）。
// 目前為單一婚禮的手動內容，真實照片與文案陸續由使用者提供後在此置換；
// 缺乏資訊的欄位一律填入「待補」字樣，明確標示為站位內容而非虛構事實。
import type { StoryContent, StoryPhoto, StorySection } from '~/types/story'

function buildSection(key: string, label: string, sectionIndex: number, count: number): StorySection {
  const photos: StoryPhoto[] = Array.from({ length: count }, (_, i) => {
    const num = String(i + 1).padStart(2, '0')
    return {
      src: `/images/story/wall-${sectionIndex}-${num}.webp`,
      caption: '待補回憶文字',
      eager: i < 3,
    }
  })
  return { key, label, photos }
}

export function useStoryContent(): StoryContent {
  return {
    hero: {
      namesZh: '振茗 ＆ 品儀',
      namesEn: 'Alex & Lele',
      date: '2026.11.22',
      tagline: 'I Shine in your Love',
      ctaLabel: '拖曳看看我們的回憶',
      heroImage: '/images/story/hero-01.webp',
    },
    sections: [
      buildSection('meet', '遠距戀愛十一年', 1, 9),
      buildSection('daily', '每天視訊交換日常', 2, 9),
      buildSection('propose', '不厭其煩的配合', 3, 9),
    ],
    notes: [
      { text: '（待補文字：想寫給彼此的一句話）' },
      { text: '（待補文字）' },
      { text: '（待補文字）' },
      { text: '（待補文字）' },
    ],
    guestMessage: {
      body: '（給賓客的話待補：想寫一段話，給今天到場的你們）',
      signature: '振茗 & 品儀',
    },
    venue: {
      dateTime: '2026/11/22（日）入席 12:00 ／ 開席 12:30',
      venueName: '新竹晶宴會館御豐館',
      hallName: '綺麗劇場',
      address: '新竹市東區光復里公道五路三段1號2樓',
      mapLink: 'https://maps.app.goo.gl/ejsZgwzUS9BohsPAA',
      transportInfo: '（交通方式待補）',
      dressCode: '香檳、奶油、米白、燕麥色',
    },
    music: {
      src: '/audio/wedding-bgm.mp3',
    },
  }
}
