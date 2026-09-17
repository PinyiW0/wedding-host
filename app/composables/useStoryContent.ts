// 公開婚禮故事首頁（/story/[weddingId]）的靜態內容。
// 單一婚禮的手動內容；尚未到位的欄位留空字串或標「待補」，不虛構事實。
// 公里數是兩地市中心的直線距離（haversine），見 docs/public-landing-assets.md。
import type { StoryCat, StoryCatScene, StoryContent, StoryFlowerCat, StoryHeroTile, StorySlide, StorySpread, StoryTextRun } from '~/types/story'

// 首屏的祝福圓：婚紗照繞成一圈，點一張就在圓心翻出一句祝福。
// 祝福是新人 2026-09-04 寫的定稿（原稿 15 句，取 12 句，捨去第 10、14、2 句——順序是新人指定的）。
const HERO_WISHES = [
  '願你所遇皆溫柔，所盼皆如願。',
  '願平凡的日子裡，總有小小的幸福。',
  '願你愛的人，也一直好好愛著你。',
  '願往後的每一天，都有值得期待的事。',
  '願所有美好，都在剛剛好的時候與你相遇。',
  '願你的生活有花、有光，也有愛。',
  '願每一次出發，都通往喜歡的地方。',
  '願你的身邊，永遠有人與你分享快樂。',
  '願你常有歡喜，也常有好運。',
  '願日子慢慢走，幸福慢慢長。',
  '願你被世界溫柔以待，也有力量擁抱生活。',
  '願今天收到的幸福，也一路陪你很久很久。',
]

// 24 張照片繞滿一圈，場景已在裁切時打散，繞一圈不會連著同一個場景。
// 第 k 張配第 k % 12 句：同一句在圓的正對面再出現一次。桌機圓心壓低、只露出上半圈，
// 一次看到的還是 12 句各一次；手機整圈都露出來，只取前 12 張。
// 素材是從 /gallery 的原比例照片重裁的 320px 正方小圖（處理方式見 docs/public-landing-assets.md）：
// 原本借用的 wall-*.webp 早就裁成 1100×1100，有七、八張在那一步就把人頭切掉了，
// 而圓上一格只顯示 83px，用 1100px 的素材也是白費（24 張 2.0MB → 404KB）
const HERO_PHOTOS = Array.from({ length: 24 }, (_, i) =>
  `/images/story/ring-${String(i + 1).padStart(2, '0')}.webp`)
const heroTiles: StoryHeroTile[] = HERO_PHOTOS.map((src, k) => ({ src, message: HERO_WISHES[k % HERO_WISHES.length]! }))

// 結尾那一區的拖尾照片：相簿三批裡全部 42 張直式縮成長邊 320px（public/images/story/trail-01～42.webp）。
// 池子越大滑鼠掃過越不會繞回同一張（新人 09-15：「用原本那 30 張就不會重複」）；16 張橫式不放——塞進 3:4 的拍立得會切掉人。
// 順序是同場景連著出（草原 19 → 海邊 15 → 都會 8）：三種場景輪流出過一版，連著冒的每張換色調，新人說「散散的」，同場景連著出色調才連貫。
// 數字是 trail 檔的編號、陣列順序才是出場順序：01～36 是前兩批（檔名就是當時的出場順序），
// 37～42 是第三批（09-17）的六張直式（依序來自相簿 51、53、54、58、61、62），穿插進各自的場景裡、不重排舊檔；
// trail-19、23 同一天換成重修版（相簿 42、50）。trail 檔對回相簿編號的整張表在 docs/public-landing-assets.md §68
const TRAIL_MEADOW = [1, 38, 2, 3, 4, 5, 6, 37, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const TRAIL_SEASIDE = [18, 39, 19, 20, 40, 21, 22, 41, 23, 24, 42, 25, 26, 27, 28]
const TRAIL_CITY = [29, 30, 31, 32, 33, 34, 35, 36]

// 桌機左緣的直排英文（新人 2026-09-04 定稿），固定兩行、不折第三行。
// 三個數字的開頭與「orbits」「home」用 Cormorant 斜體，跟頁面上所有數字走同一套襯線
const heroAside: StoryTextRun[][] = [
  [
    { text: '11 years · 201 km · 0 distance', em: true },
    { text: ' — Two separate worlds finding their ' },
    { text: 'orbits', em: true },
  ],
  [
    { text: 'through endless train rides, bringing two hearts together in a ' },
    { text: 'home', em: true },
    { text: ' made just for us.' },
  ],
]

// copyAt.top 在 2026-09-15 頁碼（01 ——）拿掉後重量過：文字塊的垂直中心對齊同一頁拼貼件的中心（1440×900 實測），不再是設計稿含頁碼的上緣。
// 七頁的標題與內文是新人 2026-09-03 提供的定稿，分行照原文。年份是新人給的：大學 2015–2016、研究所 2017–2019、工作 2020–2026；
// 第 2、5 頁是同一段時期裡的片刻，不重複標年份（線下方留白）
const slides: StorySlide[] = [
  {
    key: 'ticket-201',
    title: '201 公里的車票',
    lines: [
      '我們隔著高雄與花蓮、整整 201 公里的距離。',
      '每一次相見，都是一段 5 個小時的火車旅程。',
      '距離很遠，所以能擁抱的每一刻，都格外珍惜。',
    ],
    // 新人提供的兩張拍立得掃描（自帶白框與傾角）與火車插畫。
    // 角度、尺寸與位置都照設計稿（Desktop - 3.png）量：海報朝左歪 12°、月台朝右歪 9.5°，各貼一截紙膠帶。
    // tilt 是「再轉多少」不是最終角度。素材自帶的角度用最小外接框量（門檻 alpha>200，避開投影——
    // 用白框上緣連線量會把投影算進去，月台那張會量成 +21°，差了 30 度）：海報 0°、月台 −10.5°。
    // 所以海報 −12 ＝ 朝左歪 12°，月台 +20 ＝ 朝右歪 9.5°。
    // 2026-09-15 新人說四周的東西散亂：四件原本各佔一角、彼此沒有關係，改成左右兩組夾著置中的文字——
    // 左組海報＋綁在上緣的蝴蝶結（取代紙膠帶）、右組月台＋壓在下緣的車票（回到設計稿原本的關係）；
    // 兩組的垂直中心都落在文字中心附近，傾角收小（海報 −7°、月台 +5.5°），不再像被風吹散
    photos: [
      { src: '/images/story/photo-1.webp', alt: '兩人在「不在中途放手」的海報前牽手', eager: true, framed: true, tilt: -7, at: { x: 15, y: 50, w: 19 } },
      { src: '/images/story/photo-2.webp', alt: '雨後的火車站月台與鐵軌', eager: true, framed: true, tilt: 16, tape: true, at: { x: 85, y: 40, w: 20.5 } },
    ],
    // 水彩火車 2026-09-15 拿掉：車票與月台照片已經在講火車，時間軸上改由沿軌道跑的金線小火車接手（StoryDeck）。
    // 素材檔留著，原本是 { src: '/images/story/train.webp', at: { x: 63, y: 82.4, w: 33.7 } }
    illustration: null,
    // 車票：這一頁的標題就是車票，實物擺出來才不只是講一個數字。壓在月台那張拍立得的左下緣
    objects: [
      { src: '/images/story/ticket.webp', alt: '高雄到花蓮的火車票', at: { x: 78, y: 64, w: 17.5 }, tilt: -4 },
    ],
    // 這一頁照新人 2026-09-13 的設計稿排成拼貼台；其餘各頁的設計不同，逐頁定案後才各自指定
    layout: 'stage',
    // 文字置中：盒子中心放在 48.75%（.copy 的 lg:pl-6 會把文字中心往右推 12px ＝ 960 的 1.25%）
    copyAt: { left: 27.4, right: 29.9, top: 30 },
    // 扁平金星與金色愛心 2026-09-15 拿掉（第 1、2 頁同）：整頁的插畫只留水彩一種聲音，蝴蝶結是水彩所以留著。
    // 金星金心的圖形還在 StoryDoodles，放回 kind 就能救回
    // 蝴蝶結綁在海報那張拍立得的上緣偏右，取代原本的紙膠帶
    doodles: [
      { kind: 'bow', x: 21.5, y: 30, w: 12 },
    ],
    shift: 5,
    marker: { kind: 'span', from: '高雄', to: '花蓮', km: 201 },
    years: '2015 – 2016',
  },
  {
    key: 'letters',
    title: '青澀的陪伴',
    // 斷行照新人 2026-09-14 給的：兩行、空一行、再四行；最後一句新人沒重列但設計稿有，保留
    lines: [
      '見不到面的日子，',
      '我們把想念一筆一畫寫進鋼筆信裡。',
      '',
      '畢業製作通宵的夜晚有你陪著，',
      '佈展最焦慮時有你加油。',
      '那時買不起真的戒指，',
      '你用金莎包裝紙捏了一朵玫瑰套在我指尖——',
      '那是我收過最特別的禮物。',
    ],
    // 三張拍立得照 Desktop - 4.png 量：金莎玫瑰戒指、日出、鋼筆信。
    // 三張的自帶傾角（−0.5°／+3.5°／+6.5°）就等於設計稿上的角度，所以都不必再轉
    photos: [
      { src: '/images/story/photo-rose-ring.webp', alt: '金莎包裝紙捏成的玫瑰戒指', eager: false, framed: true, at: { x: 64.5, y: 56.9, w: 28.9 } },
      { src: '/images/story/photo-sunrise.webp', alt: '雲層後透出光的天空', eager: false, framed: true, at: { x: 84.6, y: 19.3, w: 17.9 } },
      { src: '/images/story/photo-letter.webp', alt: '方格紙上用鋼筆寫的信與一支鋼筆', eager: false, framed: true, at: { x: 87, y: 66.7, w: 25.8 } },
    ],
    illustration: null,
    layout: 'stage',
    // 四件小物：布膠帶與滿天星壓在照片下面；愛心迴紋針（沿用 /invite 的素材）夾在金莎那張的左上角、壓在照片上面
    // （新人 09-14：原本 9.9 有點太大、也不該被壓在拍立得下面——設計稿上它是 10.6，收到 8，介於設計稿與其他頁的 5.3 之間；
    // 位置照設計稿：愛心的左半掛在布膠帶左緣外、下面的迴圈搭在白框上）；鋼筆壓在鋼筆信上面。
    // 滿天星素材四周有很淡的透明邊，元素得比看得見的花束大一圈（量到的可見寬 112px → 元素 17.1%）；
    // 布膠帶的下緣被金莎那張蓋住，高度由素材比例推
    objects: [
      { src: '/images/story/heart-tape.webp', alt: '', at: { x: 63.1, y: 20.3, w: 29.5 }, tilt: -5, behind: true },
      { src: '/images/story/babysbreath.webp', alt: '', at: { x: 97.5, y: 23.1, w: 17.1 }, behind: true },
      { src: '/images/invite/clip-heart.webp', alt: '', at: { x: 53.4, y: 24.7, w: 8 } },
      { src: '/images/story/pen.webp', alt: '', at: { x: 99.9, y: 75.4, w: 28.5 } },
    ],
    // 這一頁文字靠左（設計稿：中心 x 511；.copy 的 lg:pl-6 會把文字中心往右推 12px，盒子中心要放在 499）。
    // 寬度要放得下最長那行「你用金莎包裝紙捏了一朵玫瑰套在我指尖——」不折行
    copyAt: { left: 7, right: 53, top: 18 },
    shift: 5,
    marker: null,
    years: '',
  },
  {
    key: 'wait-111',
    title: '111 公里的守候',
    // 第一句的斷行照新人 09-14 給的
    lines: [
      '研究所時，新竹到花蓮的 111 公里，',
      '被忙碌的論文與研究填滿。',
      '見面的時間變少了，但每天的視訊陪伴從不缺席。',
      '螢幕兩端聽著彼此的鍵盤聲與呼吸聲，',
      '原來最深的浪漫，是習慣了有你在的每一個日常。',
    ],
    // 視訊陪伴的兩端，一人一張（Desktop - 5.png）。兩張的自帶傾角（−5°／+2.5°）就是設計稿上的角度
    photos: [
      { src: '/images/story/photo-desk-her.webp', alt: '女生托著臉看著筆電的手繪插畫', eager: false, framed: true, at: { x: 16.5, y: 54.5, w: 25.7 } },
      { src: '/images/story/photo-desk-him.webp', alt: '男生托著臉看著筆電的手繪插畫', eager: false, framed: true, at: { x: 38.7, y: 37.9, w: 25.7 } },
    ],
    illustration: null,
    layout: 'stage',
    // 兩個愛心迴紋針各夾在一張拍立得的上緣，珍奶與布丁壓在兩張的下緣（都在照片上面）
    objects: [
      { src: '/images/invite/clip-heart.webp', alt: '', at: { x: 6.2, y: 31.1, w: 5.3 } },
      { src: '/images/invite/clip-heart.webp', alt: '', at: { x: 48.1, y: 9.5, w: 5.3 } },
      { src: '/images/story/dessert.webp', alt: '', at: { x: 34.6, y: 65.2, w: 19.3 } },
    ],
    // 一筆畫的愛心線把兩張拍立得連起來（見 StoryDoodles 的 heart-line）。
    // 原本是紅色，2026-09-15 改成金色（全頁手繪只有它是紅）；試過改成綁住兩個迴紋針的相片繩，新人覺得怪，形狀維持原本的愛心
    doodles: [
      { kind: 'heart-line', x: 21.8, y: 21.3, w: 16.1 },
    ],
    // 這一頁文字靠右，右緣還超出拼貼台一點（設計稿：中心 x 1006.5；.copy 的 lg:pl-6 會把文字中心往右推 12px，盒子中心放在 994.5）
    copyAt: { left: 53.25, right: -4.15, top: 22 },
    marker: { kind: 'span', from: '新竹', to: '花蓮', km: 111 },
    years: '2017 – 2019',
  },
  {
    key: 'gentle-65',
    title: '65 公里的溫柔',
    // 第二句的斷行照新人 09-14 給的：「不在同個城市，」自己一行、外送與探班一行（設計稿也是這樣）
    lines: [
      '出社會後，距離縮短到了 65 公里。',
      '不在同個城市，',
      '但工作疲憊時有你外送來的飲料、毫無預警的探班，',
      '還有你不厭其煩開車送我回家的側臉。',
      '你成了我家最可靠的專屬水電工，替我修補生活裡的大小雜事。',
    ],
    // 這一頁沒有拍立得（Desktop - 6.png）：右半邊是一張夜景插畫，右下角掛一串鑰匙圈
    photos: [],
    // 夜景走 illustration 不走 objects：小物只在桌機排得下，而這張是這一頁唯一的畫面，手機也得看得到
    illustration: { src: '/images/story/night.webp', alt: '夜裡的城市與高架路，遠處亮著路燈', eager: false, framed: false, at: { x: 74.4, y: 45.6, w: 69.2 } },
    layout: 'stage',
    objects: [
      { src: '/images/story/keyring.webp', alt: '', at: { x: 98.5, y: 73.9, w: 18.8 } },
    ],
    // 這一頁文字靠左（設計稿：中心 x 428.5）。寬度要放得下最長的一句「你成了我家最可靠的專屬水電工，替我修補生活裡的大小雜事。」不折行
    // （原本 43% 寬時它折成兩行、第二行只剩「小雜事。」），所以左緣超出拼貼台一截；右緣不動，才不會壓到夜景的左緣。
    // .copy 的 lg:pl-6 會把文字中心往右推 12px
    copyAt: { left: -11.5, right: 60.1, top: 26 },
    marker: { kind: 'span', from: '新竹', to: '台北', km: 65 },
    years: '2020 – 2026',
  },
  {
    key: 'family-of-five',
    title: '我們的五口之家',
    lines: [
      '後來，三隻小貓咪加入了我們的生活。',
      '從兩個人變成五口之家，',
      '最幸福的事，莫過於一起賴在家裡蹭貓咪，過著平凡的小日子。',
    ],
    // 這一頁沒有拍立得（Desktop - 7.png）：右半邊只有一張抱著三隻貓的插畫
    photos: [],
    // 跟夜景那頁同理走 illustration 不走 objects：這是本頁唯一的畫面，手機也得看得到
    illustration: { src: '/images/story/cats-family.webp', alt: '新人一起抱著三隻布偶貓的手繪插畫', eager: false, framed: false, at: { x: 75.4, y: 46.2, w: 47.9 } },
    layout: 'stage',
    // 這一頁文字置中偏左（設計稿：x 301–721，中心 511）。
    // 寬度收到剛好放得下 19 個字，第三行才會跟設計稿一樣斷在「蹭貓咪，」之後
    copyAt: { left: 9.8, right: 55.9, top: 30 },
    shift: 6.5,
    marker: null,
    years: '',
  },
  {
    key: 'delivery',
    title: '神奇的外送',
    lines: [
      '從 201 公里、111 公里，到 65 公里，',
      '我們一起走過了整整十年。',
      '2025 年 5 月 21 日，',
      '你偷偷叫我下樓拿飲料外送，',
      '我踩著拖鞋跑下去，出現的不是外送員，',
      '而是捧著大束鮮花的你。',
    ],
    // 這一頁只有一張拍立得：MARRY ME 燈牌（Desktop - 8.png）。
    // 素材自帶的 −3.5° 就是設計稿上的角度，tilt 留空
    photos: [
      { src: '/images/story/photo-marryme.webp', alt: 'MARRY ME 燈牌與氣球燈串', eager: false, framed: true, at: { x: 75.1, y: 48.3, w: 50.3 } },
    ],
    illustration: null,
    layout: 'stage',
    // 愛心迴紋針夾在拍立得右上角，玫瑰花束與珍奶壓在拍立得下緣（都在照片上面）
    objects: [
      { src: '/images/invite/clip-heart.webp', alt: '', at: { x: 91.6, y: 9.3, w: 5.2 } },
      { src: '/images/story/rose-bouquet.webp', alt: '', at: { x: 56.7, y: 75.0, w: 22.5 } },
      { src: '/images/story/bubble-tea.webp', alt: '', at: { x: 99.2, y: 74.6, w: 11.9 } },
    ],
    // 這一頁文字置中偏左（設計稿：中心 x 452）
    copyAt: { left: 3.3, right: 60.9, top: 26.3 },
    shift: 3.5,
    marker: null,
    years: '2025.05.21',
  },
  {
    key: 'zero',
    title: '距離歸零，我們結婚吧！',
    lines: [
      '走過了數不清的車票與公里數，',
      '這一次，我們決定把距離直接歸零——我們結婚啦！',
    ],
    // 距離歸零這一頁不放照片：改用一對粒子婚戒（見 docs/public-landing-assets.md §30）
    photos: [],
    illustration: null,
    visual: 'rings',
    shift: 5,
    marker: { kind: 'zero' },
    years: '2026.11.22',
  },
]

// 七頁之後的書（新人 2026-09-14 的設計稿 Desktop - 9 … 13.png）：五個跨頁像書頁翻過去，翻完才往下捲。
// 第 8 頁的標題與第 7 頁重複是新人的裁示（第 7 頁留戒指粒子、書從第 8 頁開始）。
// 第 9、12 頁的字烙在照片上（新人給的檔就是這樣），不再疊活字免得重影，字寫進 alt；之後給乾淨照片再改。
// 照片與設計稿同尺寸（一面 720×1024 的 2 倍），不縮
const spreads: StorySpread[] = [
  {
    kind: 'pages',
    key: 'proposal',
    // 標題與內文是新人 09-14 改的（原本沿用第 7 頁的「距離歸零，我們結婚吧！」）；「邀情」照語意寫成「邀請」
    title: 'We’re getting married!',
    left: {
      kind: 'copy',
      eyebrow: '',
      lines: ['誠摯邀請您來參加我們的婚禮'],
      // 鋪滿整面的水彩插畫 2026-09-15 拿掉（畫的是右頁同一張照片，滿版時兩頁像同一張圖）；素材檔留著。
      // 同一天新人給了去背的版本，改成標題上方的小插圖：縮小之後讀起來是「插畫版 ↔ 照片版」的對頁，不再是重複。
      // 素材清掉了牆柱兩側烘死的棋盤格（假透明），見 docs §48
      vignette: { src: '/images/story/book-proposal-vignette.webp', width: 532, height: 720 },
    },
    // 右上是灰石牆、右下是黑禮服：選單開關與「下一站」在這一跨換紙白（§49）
    right: { kind: 'photo', src: '/images/story/book-proposal.webp', alt: '兩人在 DOLCE & GABBANA 店門前拿著黑色愛心氣球：will you marry me? 與 yes!', focus: { x: 50, y: 30 }, darkCorners: ['top', 'bottom'] },
  },
  // 照片左下角原本烙著「In Your Love / I Shine」，已用擴散補圖抹掉（docs §39），改疊首屏那組活字的紙白版。
  // 整張是樹蔭：兩個角都深，控制項換紙白。
  // 裁切重心 y 0：照片鋪滿桌機兩面時上下各裁 6%，置中裁會切掉新郎的頭頂（新人 09-15），改成從上緣起算、只裁下面的裙襬
  { kind: 'bleed', key: 'shine', title: 'In Your Love, I Shine', src: '/images/story/book-shine.webp', alt: '樹蔭下滿天泡泡裡，兩人額頭相抵微笑', mark: { title: 'In Your Love', script: 'I Shine' }, darkCorners: ['top', 'bottom'], focus: { x: 50, y: 0 } },
  {
    kind: 'pages',
    key: 'groom',
    title: '振茗',
    left: { kind: 'photo', src: '/images/story/book-groom.webp', alt: '新郎穿灰西裝站在海邊的草叢裡，手捧一束乾燥花', focus: { x: 50, y: 22 } },
    right: {
      kind: 'copy',
      eyebrow: 'Meet the Groom',
      lines: ['溫柔隨和，凡事都往好處想，', '不拘小節，也不忘幽默一下。', '他的世界很簡單——', '', '人生嘛，開心比較重要～'],
    },
  },
  {
    kind: 'pages',
    key: 'bride',
    title: '品儀',
    left: {
      kind: 'copy',
      // 設計稿寫成 MEET THE BBRIDE，是筆誤
      eyebrow: 'Meet the Bride',
      // 結尾的 ♡ 用不換行空格黏著前一個字，窄欄時不會自己掉到下一行
      lines: ['細膩認真，對喜歡的事總有自己的想法，', '偶爾想得有點多，', '卻也因此把每件事放在心上。', '她的世界藏著很多小小的浪漫——', '', '日子嘛，當然要過成自己喜歡的樣子\u00A0♡'],
    },
    // 右上是深綠草坡（選單開關換紙白）；右下是粉色裙襬，維持墨色
    right: { kind: 'photo', src: '/images/story/book-bride.webp', alt: '新娘穿粉色禮服站在草坡上，雙手貼著臉頰，笑著看向前景的新郎', focus: { x: 55, y: 25 }, darkCorners: ['top'] },
  },
  // 照片左下角原本烙著這兩句，同樣用補圖抹掉（docs §40），改成活字
  { kind: 'bleed', key: 'orbit', title: '兩個獨立運行的星球', src: '/images/story/book-orbit.webp', alt: '夕陽下的海邊，兩人牽著手走在沙灘上', caption: ['兩個獨立運行的星球', '在漫長時光裡，找到彼此的軌道'] },
]

// 文案沿用 /invite 的貓咪紙條（useInviteScene cats）；斷行照新人 2026-09-14 給的（\n 是換行，StoryCats 用 whitespace-pre-line 排）
// 這份是三隻貓名字的唯一出處——花田彩蛋直接引用，不另存一份；陣列順序花田的 CAT_ARRANGE 靠 index 對應，不要重排
// spot：在同框場景圖裡的位置（圖寬／圖高的百分比，用 10% 格線量的，見 docs §45）。
// 左邊坐著舉手的是 Happy、中間橘白的是肥肥、右邊趴著翹尾巴的是錢錢（新人 2026-09-15 確認）
const cats: StoryCat[] = [
  {
    key: 'money',
    name: '錢錢',
    nameEn: 'Money',
    role: '家裡的招財擔當，\n專門把好運和幸福帶回家。',
    line: '謝謝你們來參加爸爸媽媽的婚禮！',
    spot: { box: { x: 64, y: 34, w: 34, h: 64 }, head: { x: 76, y: 46 } },
  },
  {
    key: 'healthy',
    name: '肥肥',
    nameEn: 'Healthy',
    role: '家裡的溫柔小寶貝，\n負責用可愛療癒大家。',
    line: '要來一起見證爸爸媽媽的重要日子！',
    spot: { box: { x: 39, y: 14, w: 24, h: 76 }, head: { x: 55, y: 17 } },
  },
  {
    key: 'happy',
    name: 'Happy',
    nameEn: 'Happy',
    role: '家裡的快樂製造機，\n每天的任務就是讓大家笑出來。',
    line: '爸爸媽媽結婚我超開心！\n所以也要把我的 Happy 分給你們！',
    spot: { box: { x: 3, y: 24, w: 35, h: 74 }, head: { x: 21, y: 27 } },
  },
]

/** 三隻貓同框追羽毛（新人 2026-09-15 給的）：1536×1024、已去背、WebP q80 約 312KB；原始 PNG 不入 repo（同著裝插畫的做法） */
const catScene: StoryCatScene = {
  src: '/images/story/cats-play.webp',
  alt: '三隻貓抬頭追著飄落的羽毛：左邊坐著舉手的 Happy、中間橘白色的肥肥、右邊趴著翹尾巴的錢錢',
  width: 1536,
  height: 1024,
}

// 花田彩蛋的耳朵座標：量 hide 那張的 alpha 邊界框換算成整叢花外框裡的百分比（中心點＋視覺尺寸）。
// 三隻的耳朵在各自畫布上的高低本來就不同，所以三組數字不一樣，量測過程見 docs/public-landing-assets.md §23
const FLOWER_CAT_EARS: Record<string, StoryFlowerCat['ear']> = {
  money: { x: 51.2, y: 41.6, w: 37.6, h: 16.5 },
  healthy: { x: 52.4, y: 44.7, w: 41.2, h: 19.2 },
  happy: { x: 50.7, y: 45.4, w: 38.3, h: 16.2 },
}

// 藏在花田裡的三隻貓：名字直接取自上面的 cats，這裡只補兩張圖與耳朵座標
const flowerCats: StoryFlowerCat[] = cats.map(cat => ({
  key: cat.key,
  name: cat.name,
  hide: `/images/story/cat-${cat.key}-hide.webp`,
  appear: `/images/story/cat-${cat.key}-appear.webp`,
  ear: FLOWER_CAT_EARS[cat.key] ?? { x: 50, y: 45, w: 38, h: 17 },
}))

export function useStoryContent(): StoryContent {
  return {
    hero: {
      namesZh: '振茗 ＆ 品儀',
      titleEn: 'In Your Love',
      scriptText: 'I Shine',
      subtitle: '從 201 km 開始的十一年',
      // 201 公里就是故事第一頁大學那段高雄—花蓮的距離，兩地與數字對得起來（新人 2026-09-04 確認）；
      // 年份是整段故事的起訖，不是那一段的
      distance: { from: 'Kaohsiung', to: 'Hualien', years: '2015 → 2026' },
      // 手機是直向翻頁（issue #162），提示改成往下滑；圓上的照片可以點這件事也要講出來（新人 09-16：怕賓客不知道要點）
      cta: { start: '出發', next: '下一站', end: '繼續往下', hint: '往下滑，出發' },
      ringHint: '點一張照片，領取祝福',
      tiles: heroTiles,
      aside: heroAside,
    },
    slides,
    spreads,
    cats,
    catScene,
    // 當天流程：三個時間是新人給的。中間那個是**唯一要賓客行動的**指示，
    // 入席與開席只是背景資訊——所以只有它標 highlight，版面上放大的也只有它。
    // 日期不在這裡（新人 09-14 拿掉），婚宴資訊那一區有
    schedule: {
      stops: [
        { key: 'seating', time: '12:00', label: '入席' },
        { key: 'arrive', time: '12:15', label: '建議到場', highlight: true },
        { key: 'start', time: '12:30', label: '開席' },
      ],
    },
    // 花田素材皆由新人提供，頁面一律用裁掉透明邊、縮小後的 .webp（見 docs §8、§23）。
    // 三朵花的 .png 原檔留在同資料夾；花田橫幅與六張貓圖的原檔合計 18.3 MB，新人決定不入 repo（原檔在他們自己手上）
    flowerField: {
      centerArt: '/images/story/cat-flower.webp',
      centerAlt: '三隻小貓坐在花叢裡的手繪插畫',
      // 三朵花排在花田上方（新人指定，先不放賓客的花圈）
      // 2026-09-15 曾因「蠟筆筆觸與水彩花田不合」拿掉，09-16 新人看過預覽站後要求放回：
      // 這三朵是新人自己畫的、也是「回覆喜帖就是種下你的那一朵」的示範，沒有它們花田上方是空的（§61）
      flowers: ['/images/story/liflower.webp', '/images/story/sflower.webp', '/images/story/yflower.webp'],
      banner: '/images/story/flower-field.webp',
      bannerAlt: '一整條盛開的花田，粉白玫瑰、雛菊與藍色小花',
      cats: flowerCats,
    },
    venue: {
      // 只留日期：入席／開席的時間已由上面的 schedule 負責，同一份資訊不在兩區各寫一次
      dateTime: '2026/11/22（日）',
      venueName: '新竹晶宴會館御豐館',
      hallName: '綺麗劇場',
      address: '新竹市東區光復里公道五路三段1號2樓',
      mapLink: 'https://maps.app.goo.gl/Aq4uMfJDdKmEUjYk7',
      // 短網址（maps.app.goo.gl）塞進 iframe 會被 Google 擋掉，只能當外連。
      // 嵌入改走免金鑰的 maps?q=…&output=embed；Maps Embed API 要 API key，本專案沒有也不為此新增。
      // q 用場地名而非地址：實測地址只落一根無名圖釘，場地名會帶出「晶宴會館-御豐館」的名稱卡。
      mapEmbed: 'https://www.google.com/maps?q=%E6%96%B0%E7%AB%B9%E6%99%B6%E5%AE%B4%E6%9C%83%E9%A4%A8%E5%BE%A1%E8%B1%90%E9%A4%A8&output=embed',
      mapTitle: '新竹晶宴會館御豐館位置地圖',
      transport: {
        dropOff: '不論搭哪一種車，下車點都是同一處——公道五路與忠孝路口的 TFC ONE 商業大樓。',
        groups: [
          {
            key: 'train',
            title: '搭火車',
            titleEn: 'By Train',
            note: '',
            routes: [
              { label: '新竹站', detail: '於計程車排班區轉搭計程車，約 3–4 公里，車資約 160–200 元。' },
              { label: '北新竹站', detail: '出站轉搭計程車，約 1–2 公里，車資約 110–140 元。' },
            ],
          },
          {
            key: 'hsr',
            // 標題沿用新人原文的分組標籤，不自行推論各路線的出發站
            title: '搭高鐵（新竹站）',
            titleEn: 'By High Speed Rail',
            note: '',
            routes: [
              { label: '計程車', detail: '於計程車排班區搭車，約 8 公里，車資約 250–300 元。' },
              { label: '公車', detail: '1 樓車站大廳 4 號出口右側搭 182 路（北大橋—高鐵新竹站），於「工研院光復院區」下車，往東走光復路二段接忠孝路，步行約 10 分鐘。' },
              // 不寫車次：新人原文的 1744 次查證後是「新竹 → 六家」，對從高鐵站出發的賓客是反方向，
              // 且該班 14:48 才到六家（婚宴 12:30 開席）。時刻表會改，寫死一班車只會誤導，改寫方向與站數
              { label: '台鐵支線', detail: '高鐵新竹站即台鐵六家站，轉搭往新竹方向的區間車，3 站到「千甲站」，車程約 12 分鐘，出站步行約 15 分鐘。' },
            ],
          },
          {
            key: 'car',
            title: '自行開車',
            titleEn: 'By Car',
            note: '特約停車場提供 4 小時折抵：晶宴會館地下室 B1 停車場、台肥 1 樓戶外停車場。',
            routes: [
              { label: '國道一號', detail: '新竹／竹東 95A 出口下交流道，往公道五路方向走新竹出口，沿公道五路二段直行，行經特力屋（原愛買）即見 TFC ONE，於忠孝路／東勢街左轉進東勢街巷道，即地下停車場入口。' },
              { label: '竹北方向', detail: '經國大橋接慈雲路，右轉公道五路二段，行經愛買即見 TFC ONE，於忠孝路／東勢街左轉進巷道。' },
              { label: '市區方向', detail: '經國路接公道五路三段右轉，行經約 1.2 公里即見地下停車入口。' },
            ],
          },
        ],
        // 新人已確認這是他們自己的婚禮帳號，不是晶宴會館客服。
        // 文案寫明歸屬，賓客才知道加了會問到人，而不是丟進場地的公用信箱。
        lineLabel: '加入我們的婚禮 LINE，問交通與停車',
        lineUrl: 'https://lin.ee/Th6k28Tz',
      },
      // 建築外觀照 2026-09-06 曾因「另外多一張在地圖底下很突兀」拿掉；09-15 新人給了新的外觀照（g1御豐館），
      // 改成跟廳內照在同一個框裡原地輪播，不多佔版面。外觀在前：這一欄講「在哪裡」，先認得建築、再看裡面
      photos: [
        {
          src: '/images/story/venue-exterior.webp',
          alt: 'TFC ONE 大樓外觀：玻璃帷幕高樓前是金色鏤空花紋的「晶宴會館」招牌，兩側開著紫色花樹的白色大階梯',
          caption: '御豐館 · TFC ONE 商業大樓',
        },
        {
          src: '/images/story/venue-hall.webp',
          alt: '宴會廳內部：成排金色流蘇吊燈垂在天花板下，藏青座面、金色框的圓椅圍著鋪深藍桌巾的圓桌，紅金花卉地毯一路延伸到底端舞台',
          caption: '綺麗劇場 · 當天與你相見的地方',
        },
      ],
      // 這一整塊照新人 2026-09-06 的設計稿：標題、白色花草、四張水彩插畫、結語兩句。
      // 原稿的英文主標「Wear a Little Warmth」2026-09-15 拿掉：全頁統一中文標題在上、英文小字在下（§49）。
      // 只剩兩個手繪人物（女生洋裝／男生西裝）與頁尾那排花草還沒素材
      dressCode: {
        eyebrow: 'Dress Code',
        subtitle: '穿上溫柔的顏色，來見我們吧！',
        flower: {
          src: '/images/story/dress-flower.webp',
          alt: '一枝白色洋桔梗，兩朵花、一顆花苞與幾片綠葉',
          width: 52,
          height: 72,
        },
        // 色票板上的照片（新人 09-17 從相簿選 gallery-29：黃昏沙灘、米白魚尾白紗配灰西裝，色系對到香檳／米白／燕麥，
        // 也跟結尾拍立得用的粉紗草原那組錯開）。從 1111×1600 裁成 4:5 再縮到 1000 寬：
        // cwebp -crop 0 80 1111 1389 -resize 1000 0 -q 80，50KB
        look: {
          src: '/images/story/dress-look.webp',
          alt: '新娘穿米白色魚尾白紗、拿著淡紫與奶油色的捧花，新郎穿灰色西裝，兩人在黃昏的沙灘上對望',
          width: 1000,
          height: 1251,
        },
        // 四個色碼是新人指定的婚禮資料，不可改（頁面不渲染色塊，見型別註解）；
        // 材質取自原稿底部那四行（香檳緞帶／奶油色花瓣／白色薄紗／燕麥色亞麻布）。
        // 插畫的 width／height 是視覺正規化後的顯示尺寸，四張不同是刻意的——理由見 VenueInfo.vue
        swatches: [
          {
            name: '香檳',
            nameEn: 'Champagne',
            material: '緞帶',
            hex: '#F1E1BE',
            // 取色點：雲層後的夕陽光暈（x 40～54%、y 4～6% 那一帶量起來都是 #ede5d9～#f4ebd7 的暖亮色）。
            // 要離新郎的頭髮遠一點：頭髮左緣在 x 58% 上下，放 63,7 與 57,4.5 新人都說像點在頭髮上，定在 46,5
            pick: { x: 46, y: 5 },
            image: {
              src: '/images/story/dress-champagne.webp',
              alt: '香檳色緞帶打成的蝴蝶結，一條長飄帶往左延伸',
              width: 136,
              height: 66,
            },
          },
          {
            name: '奶油',
            nameEn: 'Butter Cream',
            material: '花瓣',
            hex: '#F7EEDC',
            // 取色點：捧花右側那幾朵奶油色的花
            pick: { x: 56.5, y: 54.5 },
            image: {
              src: '/images/story/dress-cream.webp',
              alt: '三片奶油色花瓣鋪開，根部帶一點淡綠',
              width: 119,
              height: 82,
            },
          },
          {
            name: '米白',
            nameEn: 'Ivory',
            material: '薄紗',
            hex: '#F4F0E8',
            // 取色點：白紗的裙身
            pick: { x: 38.5, y: 80.5 },
            image: {
              src: '/images/story/dress-ivory.webp',
              alt: '米白色薄紗打成的蝴蝶結，半透明、隱約帶一點灰藍',
              width: 104,
              height: 106,
            },
          },
          {
            name: '燕麥',
            nameEn: 'Oat',
            material: '亞麻布',
            hex: '#D8CBB3',
            // 取色點：捧花左下那束乾燥的葉子（平均色 #b9b09f）——沙灘在這張照片裡是深褐色，不像燕麥；
            // 色票的插畫本身就是一束乾燥麥穗，點在乾燥花上反而對得上
            pick: { x: 29.5, y: 62 },
            image: {
              src: '/images/story/dress-oat.webp',
              alt: '一束燕麥色乾燥麥穗，底下綁著一條亞麻緞帶',
              width: 92,
              height: 92,
            },
          },
        ],
        // 新人的基調是「建議而已」：兩句都只講到「歡迎」，不補「請避免全白」之類他們沒說的規則
        closingEn: 'Pick a shade you love ♡',
        closing: '不需要完全相同，相近色系都很歡迎',
        // figures: 手繪女生（Champagne 洋裝）與手繪男生（Oat 西裝）待新人提供，補進來就會自動出現
      },
    },
    // 婚禮當天把 enabled 改成 true 即上線；只服務這一場婚禮
    photoDrive: {
      enabled: false,
      url: 'https://drive.google.com/drive/folders/1N_svXqePPzIXKfYE4Jf_EnPrGhJcJQJd?usp=sharing',
      label: '把你今天拍的照片放進來',
    },
    // 拖尾照片：相簿三批裡全部 42 張直式（出場順序與檔案對照見檔頭的 TRAIL_*）；前 12 張進頁面就抓、其餘快捲到才抓
    trail: [...TRAIL_MEADOW, ...TRAIL_SEASIDE, ...TRAIL_CITY].map(n => `/images/story/trail-${String(n).padStart(2, '0')}.webp`),
    music: {
      src: '/audio/wedding-bgm.mp3',
      title: 'Our Song',
    },
  }
}
