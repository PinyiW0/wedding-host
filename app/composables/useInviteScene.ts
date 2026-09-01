// 婚紗入口頁（/invite/[weddingId]）的場景資料。
// 座標由 Figma 平面稿（桌機 1440×1024、手機 390×844）換算成百分比：
// x/y 是物件中心點、w 是寬度，皆相對舞台；高度由圖片自身比例決定。
// 手機版是對著 804×1748 的手機稿做模板比對校正的，素材與該稿為 1:1 像素對應——
// 也就是每個物件的 mobile.w ＝ 素材原始寬 ÷ 804（掌印、花瓣例外，設計稿裡另外縮過）。
// 微調位置只需改這個檔，不必動元件。
//
// order 是進場順序（每階 70ms，見 InviteObject 的 .si-enter）：
// 依「離視覺中心（信封／愛心）的遠近」由外而內遞增——最外圈的落葉先落定，
// 視線一路往內收，最後停在信封旁的拍立得與蠟封。標題組例外，
// 以閱讀順序 Alex → & → Lele → Wedding → Invitation 連成一氣，不拆開排。
import type { InviteScene, SceneItem } from '~/types/invite'

const ASSET_BASE = '/images/invite/'

/** 第三幕（信封與愛心卡以外的所有物件）的起跑時間 */
const SCENE_DELAY = 900

function art(name: string): string {
  return `${ASSET_BASE}${name}`
}

export function useInviteScene(weddingId: string): InviteScene {
  const storyPath = `/story/${weddingId}`
  const galleryPath = `/gallery/${weddingId}`

  const items: SceneItem[] = [
    // ── 遠景：貓掌印。三個腳印各對應一隻貓，點下去跳出招呼卡（見下方 cats）──
    // 素材很小（桌機 4.2~5.9%），點擊範圍由 InviteObject 的 .si-cat 補到 44px，視覺不變。
    // paw-01 跨在海邊拍立得的左上角（一半白邊、一半天空）：放大後的掌印是 7.1%×11.9%，
    // 相片內側左上角的空白只有 4.7%×5.5% 塞不下，再往內就會踩到新郎的頭。
    // z 從 8 提到 30：拍立得的圖片矩形（含旋轉後那一大片透明角落）本來會把三個腳印
    // 的中心點整個蓋掉，變成看得到但按不到。腳印原本就只出現在卡片以外的空隙，
    // 提高 z 在那些位置沒有任何視覺差別——已用前後對照圖確認過。
    { key: 'paw-01', src: art('paw-01.webp'), alt: '認識貓咪 Healthy', desktop: { x: 45.9, y: 45.2, w: 5.9, rotate: -25 }, mobile: { x: 15.5, y: 46.4, w: 9.1, rotate: -30 }, depth: 0.15, order: 14, phaseDelay: SCENE_DELAY, z: 30, cat: 'healthy' },
    { key: 'paw-02', src: art('paw-02.webp'), alt: '認識貓咪 Money', desktop: { x: 48.2, y: 79.2, w: 4.9 }, mobile: { x: 66.3, y: 71, w: 12.1, rotate: -10 }, depth: 0.15, order: 4, phaseDelay: SCENE_DELAY, z: 30, cat: 'money' },
    { key: 'paw-03', src: art('paw-03.webp'), alt: '認識貓咪 Happy', desktop: { x: 69, y: 73.1, w: 4.2, rotate: 15 }, mobile: { x: 19, y: 80, w: 14.9 }, depth: 0.15, order: 4, phaseDelay: SCENE_DELAY, z: 30, cat: 'happy' },

    // ── 標題組（花體字為設計稿字體資產，故走 SVG／圖片而非 web font） ──
    // 桌機版整組比設計稿放大 1.22 倍（使用者要求），以組外框中心為錨等比推算，
    // 六個物件的相對位置因此完全不變；放大後整組再左移 2.5%、上移 0.5%。
    // 位移是必要的不是美化：不移的話右緣會落在 43.2%，而海邊拍立得左緣在 42.45%，
    // 「Lele」的尾巴會貼上照片（title z=40 蓋得過去，但看起來就是擠在一起）。
    // 左邊本來就空著 13.9% 的邊界，移過去剛好把版面重心擺正。
    // 移後外框 x 8.5~40.7、y 29.1~51.5，離拍立得 1.75%、離引言 1.5%。手機版不動。
    { key: 'title-alex', src: art('Alex.svg'), alt: 'Alex', desktop: { x: 21.1, y: 36.4, w: 15.1 }, mobile: { x: 33.1, y: 10.5, w: 27.7 }, depth: 0.3, order: 5, phaseDelay: SCENE_DELAY, z: 40, eager: true },
    { key: 'title-amp', src: art('ampersand.svg'), alt: '&', desktop: { x: 30.5, y: 38.6, w: 2.1 }, mobile: { x: 50.7, y: 11.5, w: 3.9 }, depth: 0.3, order: 6, phaseDelay: SCENE_DELAY, z: 41, eager: true },
    { key: 'title-lele', src: art('Lele.svg'), alt: 'Lele', desktop: { x: 33.6, y: 42.7, w: 14 }, mobile: { x: 56.5, y: 14.6, w: 25.2 }, depth: 0.3, order: 7, phaseDelay: SCENE_DELAY, z: 40, eager: true },
    { key: 'title-celestial', src: art('star-moon-sun.webp'), alt: '', desktop: { x: 33.6, y: 34.3, w: 14.2 }, mobile: { x: 55.6, y: 9.3, w: 25.4 }, depth: 0.35, order: 7, phaseDelay: SCENE_DELAY, z: 39, eager: true },
    { key: 'title-wedding', src: art('Wedding.svg'), alt: 'Wedding', desktop: { x: 17.3, y: 43.5, w: 17.6 }, mobile: { x: 26.4, y: 14.8, w: 33 }, depth: 0.3, order: 8, phaseDelay: SCENE_DELAY, z: 42, eager: true },
    { key: 'title-invitation', src: art('Invitation.svg'), alt: 'Invitation', desktop: { x: 28.1, y: 49, w: 20.7 }, mobile: { x: 46, y: 18.2, w: 38.3 }, depth: 0.3, order: 9, phaseDelay: SCENE_DELAY, z: 42, eager: true },

    // ── 信封組：四層同 depth，視差時整體移動不會拆開 ──
    // 三層是同一個剛體，彼此的相對位移由素材幾何決定（綠內襯下緣必須低於前片 V 形谷底，
    // 否則兩者之間會露出一條背景色縫）——手機值即由桌機的層間位移換算而來，勿各自獨立微調。
    { key: 'envelope-back', src: art('envelope-back.webp'), alt: '', desktop: { x: 60.2, y: 18.4, w: 23.5 }, mobile: { x: 49.1, y: 29.4, w: 59.6 }, depth: 0.45, order: 0, z: 18, eager: true },
    { key: 'envelope-inner', src: art('envelope-background.webp'), alt: '', desktop: { x: 60.3, y: 34, w: 22.8 }, mobile: { x: 49.3, y: 42.4, w: 57.7 }, depth: 0.45, order: 0, z: 19, eager: true },
    {
      key: 'lace-heart',
      src: art('lace-heart.webp'),
      alt: '',
      desktop: { x: 58.9, y: 25.6, w: 29.3 },
      mobile: { x: 45.8, y: 35.6, w: 75 },
      depth: 0.45,
      order: 0,
      phaseDelay: 300, // 第二幕：信封落定（0~400ms）前後起跑，800ms 滑出，約 1100ms 完成
      z: 20,
      group: 'envelope',
      entrance: 'slide-up',
      eager: true,
    },
    // 熱區放在最前面的信封前片：它的圖片矩形本來就蓋住愛心卡，
    // 熱區若放在愛心上會被它擋掉點擊。hover 時整組一起浮起（見 InviteStage 的 :has 規則）。
    {
      key: 'envelope-front',
      src: art('envelope-front.webp'),
      alt: '我們結婚了！打開喜帖，看我們的故事',
      desktop: { x: 60.4, y: 38.6, w: 24.4 },
      mobile: { x: 49.6, y: 46.2, w: 61.8 },
      depth: 0.45,
      order: 0,
      z: 21,
      group: 'envelope',
      to: storyPath,
      eager: true,
    },

    // ── 中景：唱片、花、墨水 ──
    { key: 'gold-disc', src: art('gold-disc.webp'), alt: '', desktop: { x: 71.5, y: 37.9, w: 11.9 }, mobile: { x: 77.9, y: 45.9, w: 30.3 }, depth: 0.5, order: 15, phaseDelay: SCENE_DELAY, z: 14, musicToggle: true },
    { key: 'flowers-left', src: art('flowers-left.webp'), alt: '', desktop: { x: 44.6, y: 16.1, w: 23.7 }, mobile: null, depth: 0.35, order: 13, phaseDelay: SCENE_DELAY, z: 24 },
    { key: 'flowers-right', src: art('flowers-right.webp'), alt: '', desktop: { x: 72.2, y: 18.3, w: 15.2 }, mobile: { x: 74.5, y: 20.4, w: 38.7 }, depth: 0.35, order: 13, phaseDelay: SCENE_DELAY, z: 12 },
    // 手機稿裡這株本身就帶一片銀杏葉，所以 ginkgo-01 在手機版不另外出現
    { key: 'flower-single', src: art('flower-single.webp'), alt: '', desktop: { x: 50.6, y: 67.8, w: 7.6 }, mobile: { x: 23.6, y: 69.6, w: 26.1 }, depth: 0.6, order: 12, phaseDelay: SCENE_DELAY, z: 26 },
    { key: 'ink-bottle', src: art('ink-bottle.webp'), alt: '', desktop: { x: 38.8, y: 78.6, w: 9 }, mobile: null, depth: 0.5, order: 3, phaseDelay: SCENE_DELAY, z: 16 },

    // ── 近景：拍立得（與蠟封同 depth）、日期貼紙 ──
    {
      key: 'polaroid-beach',
      src: art('polaroid-beach.webp'),
      alt: '海邊婚紗照，看完整婚紗照集',
      desktop: { x: 54.2, y: 51.7, w: 23.5 },
      mobile: { x: 33.9, y: 57.3, w: 59.3 },
      depth: 0.75,
      order: 15,
      phaseDelay: SCENE_DELAY,
      z: 24,
      to: galleryPath,
      hover: 'wobble',
      eager: true,
    },
    { key: 'wax-seal', src: art('wax-seal.webp'), alt: '', desktop: { x: 53.1, y: 41.6, w: 4.1 }, mobile: { x: 31.1, y: 48.9, w: 10.4 }, depth: 0.75, order: 16, phaseDelay: SCENE_DELAY, z: 25, eager: true },
    { key: 'date-badge', src: art('date-badge.webp'), alt: '', desktop: { x: 68.4, y: 53, w: 16.3 }, mobile: { x: 69.8, y: 58.3, w: 42 }, depth: 0.65, order: 14, phaseDelay: SCENE_DELAY, z: 26 },
    {
      key: 'polaroid-forest',
      src: art('polaroid-forest.webp'),
      alt: '偷偷放閃婚紗照，看完整婚紗照集',
      desktop: { x: 58.7, y: 70.2, w: 21 },
      mobile: { x: 45.3, y: 72.8, w: 53.5 },
      depth: 0.85,
      order: 12,
      phaseDelay: SCENE_DELAY,
      z: 28,
      to: galleryPath,
      hover: 'wobble',
      // 手寫小字寫在拍立得下方那條白邊上。幾何全部是量出來的：
      // 卡片下緣線性擬合得傾角 +6.4°（殘差 0.9px）；白邊滿寬區間 y 69.8~80.5%、
      // 卡片下緣 85.3%，取中間 77%；可用寬 59%，留邊後給 56%。
      // 一行放不下（15 個字擠在 178px 只有 12px 大），所以拆兩行。
      caption: {
        lines: ['借你墨鏡😎', '我們要放閃了！'],
        mobileLines: ['婚紗相簿'],
        x: 47.5,
        y: 73,
        w: 72,
        rotate: 6.4,
        size: 5.9,
      },
      eager: true,
    },

    // ── 前景：緞帶、鋼筆、落葉 ──
    // 兩張稿的緞帶走向相反：桌機是鏡像後才對得上，手機稿則是素材原始方向，故 flip 掛在各自的 placement 上
    { key: 'ribbon-top', src: art('ribbon-top.webp'), alt: '', desktop: { x: 31, y: 12.8, w: 24.9, rotate: 11, flip: 'x' }, mobile: { x: 22.2, y: 40.4, w: 63.7 }, depth: 0.3, order: 10, phaseDelay: SCENE_DELAY, z: 23, float: 'ribbon' },
    // 右側到底部其實是同一條連續緞帶（素材兩端都有燕尾），貫穿右上到左下，不再拆兩份重複貼
    { key: 'ribbon-diag', src: art('ribbon.webp'), alt: '', desktop: { x: 65.6, y: 75.9, w: 54.1 }, mobile: { x: 53.5, y: 79.8, w: 120.8 }, depth: 0.9, order: 11, phaseDelay: SCENE_DELAY, z: 13, float: 'ribbon' },
    { key: 'pen', src: art('pen.webp'), alt: '', desktop: { x: 65.5, y: 86.2, w: 22 }, mobile: { x: 63.3, y: 85.9, w: 56.3 }, depth: 1, order: 3, phaseDelay: SCENE_DELAY, z: 34 },
    // 稿子裡另外兩片銀杏分別長在 flowers-left 與 flower-single 上，獨立的葉子只有這一片
    { key: 'ginkgo-02', src: art('ginkgo-02.webp'), alt: '', desktop: { x: 70.3, y: 96.7, w: 7.6 }, mobile: { x: 74.9, y: 94.8, w: 21.5 }, depth: 1, order: 1, phaseDelay: SCENE_DELAY, z: 36, float: 'leaf' },
    { key: 'petals', src: art('petals.webp'), alt: '', desktop: { x: 54.5, y: 91.9, w: 6.3 }, mobile: { x: 39.9, y: 95.4, w: 20 }, depth: 1, order: 2, phaseDelay: SCENE_DELAY, z: 36, float: 'petal' },
  ]

  return {
    background: {
      shadow: art('bg-shadow.webp'),
      shadowRight: art('bg-right-shadow.webp'),
      lace: art('bg-lace.webp'),
    },
    titleAlt: 'Alex & Lele — Wedding Invitation',
    tagline: ['兩個獨立運行的星球', '在漫長時光裡，找到彼此的軌道'],
    taglineEn: 'In your Love, I Shine',
    // 三隻貓的紙條文案：Happy 由新人提供、逐字照放；Healthy 與 Money 依同一結構
    // （名字／角色兩行／悄悄話兩行／結尾一句）自既有招呼詞改寫，待新人確認。
    catTrail: [art('paw-02.webp'), art('paw-03.webp'), art('paw-01.webp')],
    cats: [
      {
        key: 'healthy',
        name: 'Healthy',
        role: ['家裡的溫柔小寶貝，', '負責用可愛療癒大家。'],
        lines: ['要來一起見證', '爸爸媽媽的重要日子！'],
        closing: '♡ 一直幸福健康',
        photo: art('cat-healthy.webp'),
        w: 40,
        mobileW: 98,
      },
      {
        key: 'money',
        name: 'Money',
        role: ['家裡的招財擔當，', '專門把好運和幸福帶回家。'],
        lines: ['謝謝你們來參加', '爸爸媽媽的婚禮！'],
        closing: '♡ 紅包也可以厚厚的喵',
        photo: art('cat-money.webp'),
        facesRight: true,
        // 坐姿：同高度下寬度只有趴姿的六成多
        w: 24.4,
        mobileW: 59.7,
      },
      {
        key: 'happy',
        name: 'Happy',
        role: ['家裡的快樂製造機，', '每天的任務就是讓大家笑出來。'],
        lines: ['爸爸媽媽結婚我超開心！', '所以也要把我的 Happy 分給你們！'],
        closing: '♡ 幸福一直延續下去',
        photo: art('cat-happy.webp'),
        facesRight: true,
        w: 40,
        mobileW: 98,
      },
    ],
    intro: {
      backdrop: art('intro-bg.webp'),
      tray: art('tray.webp'),
      envelope: art('envelope-sealed.webp'),
      hint: '輕觸信封，打開喜帖',
    },
    items,
    music: {
      src: '/audio/wedding-bgm.mp3',
    },
  }
}
