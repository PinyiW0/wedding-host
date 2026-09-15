// 公開婚禮故事首頁（/story/[weddingId]）的靜態內容型別。
// 內容為單一婚禮的靜態資料，非後台可編輯的實體，故不走 app/types/api/ 的 API 合約慣例。

/**
 * 拼貼台上的一個位置：中心點與寬度，三個值都是拼貼台寬高的百分比。
 * 數字一律照該頁的設計稿量（白框中心、白框寬度），不靠目測——量法見 docs/public-landing-assets.md §32。
 * 只在桌機的拼貼台版面（StorySlide.layout === 'stage'）生效，手機仍是一疊。
 */
export interface StorySpot {
  /** 中心點 x（拼貼台寬的百分比） */
  x: number
  /** 中心點 y（拼貼台高的百分比） */
  y: number
  /** 元素寬度（拼貼台寬的百分比）。注意是**元素**寬不是白框寬：素材檔案還含投影與自帶傾角撐出的空邊 */
  w: number
  /**
   * 高度（拼貼台高的百分比）。沒給就照素材原比例長高——
   * 只有設計稿刻意把素材拉過比例時才填（滿天星就是一例）。
   */
  h?: number
}

/**
 * 拼貼台上的一件小物：一張去背素材，擺在量好的位置上。
 * behind 為真的排在照片之前（會被照片蓋住，例：金莎那張後面的布膠帶）。
 */
export interface StoryObject {
  src: string
  /** 純裝飾就留空字串——它不帶資訊，讀屏唸出來只是噪音 */
  alt: string
  at: StorySpot
  /** 還要再轉幾度（正值朝右歪）。素材自帶的角度就對的話不必填 */
  tilt?: number
  /** 壓在照片下面 */
  behind?: boolean
}

/** 散在拼貼台上的一張手繪貼紙：形狀（對應 StoryDoodles 裡的圖形）＋位置 */
export interface StoryDoodle extends StorySpot {
  /** 'heart-line' 是一筆畫的金色愛心線，走到那一頁時線會自己描出來；其餘是靜態的貼紙 */
  kind: 'bow' | 'star-a' | 'star-b' | 'star-c' | 'heart-l' | 'heart-r' | 'heart-line'
}

export interface StoryPhoto {
  src: string
  alt: string
  eager: boolean
  /** 素材自帶白框、傾角與投影（新人給的拍立得掃描）；false 時由元件補白框並微轉 */
  framed: boolean
  /** 在拼貼台上的位置；沒給就退回版面預設的兩張疊法 */
  at?: StorySpot
  /**
   * 這張要轉幾度（正值朝右歪、負值朝左歪）。素材自己已經歪的，這裡填的是**還要再轉多少**，
   * 不是最終角度——例：月台那張自帶 +21°，要看起來朝左歪 6° 就填 -27。沒給就不轉。
   */
  tilt?: number
  /** 上緣貼一截紙膠帶（素材 tape.webp）。貼在哪一側由版面的 CSS 決定 */
  tape?: boolean
}

/** 首屏圓弧上的一張照片：點開後，圓心的標題換成新人為這張照片寫的一句祝福 */
export interface StoryHeroTile {
  src: string
  message: string
}

/** 一段文字的一節：em 為真的節用斜體襯線強調（左緣直排英文用） */
export interface StoryTextRun {
  text: string
  em?: boolean
}

export interface StoryHeroContent {
  namesZh: string
  /** 大字第一行，例：In Your Love */
  titleEn: string
  /** 手寫字樣（SVG）的內容，當無障礙名稱，例：I Shine */
  scriptText: string
  /** 一句話點題，例：從 201 km 開始的十一年。句子裡「數字＋km」會被拆出來單獨排版（金色襯線、小型大寫） */
  subtitle: string
  /** 副標裡的距離滑鼠移過去浮出的小卡：兩地與起訖年份（英文，配 Cormorant） */
  distance: {
    from: string
    to: string
    years: string
  }
  /** 翻頁的文字：桌機按鈕的首屏、中途、翻完（沿用車票的語彙：出發／下一站／繼續往下），與手機的操作提示 */
  cta: {
    start: string
    next: string
    end: string
    hint: string
  }
  /** 整圈的照片與祝福，從正上方順時針排一圈；後半圈把祝福再排一次，桌機只露上半圈時才不會稀疏。空陣列＝不畫圓 */
  tiles: StoryHeroTile[]
  /** 桌機左緣的直排英文（一句話點題的英文版），由下往上讀；外層一個元素＝一行，行內再分節 */
  aside: StoryTextRun[][]
}

/** 時間軸上的標記：兩地相隔（兩顆愛心框出公里數），或距離歸零（線停在一顆愛心） */
export type StoryMarker
  = | { kind: 'span', from: string, to: string, km: number }
    | { kind: 'zero' }

/** 故事的一頁：標題、幾行文字、兩張拍立得（＋插畫），與時間軸上的標記 */
export interface StorySlide {
  key: string
  title: string
  /** 內文，一行一段（照新人給的分行）；空字串＝段落間距 */
  lines: string[]
  /** 0～2 張，超過的不顯示 */
  photos: StoryPhoto[]
  /** 配圖插畫（例：夜景）；null 時桌機留一個佔位框 */
  illustration: StoryPhoto | null
  /**
   * 散在拼貼台上的小物（車票、布膠帶、滿天星、鋼筆…）。
   * 它們是這一頁的實物、不是手繪貼紙，所以跟著內容走，位置一樣照設計稿量。桌機才排得下，手機不顯示。
   */
  objects?: StoryObject[]
  /**
   * 這一頁桌機的版面。'stage'＝整頁一張拼貼台，照片、插畫與貼紙各自貼在設計稿量出的座標上。
   * 沒給就是預設的左文右圖。每一頁的設計各自不同，逐頁定案後才在這裡指定，不預設套用。
   */
  layout?: 'stage'
  /** 拼貼台上文字塊的位置：左緣、右緣（距右界）、上緣，皆為百分比。沒給用預設（置中偏右） */
  copyAt?: { left: number, right: number, top: number }
  /** 散在這一頁拼貼台上的貼紙。每一頁的設計不同，位置各量各的 */
  doodles?: StoryDoodle[]
  /**
   * 桌機整頁內容再往下推多少（vh）。內容收在上半、時間軸在下方時，中段會空一截；
   * 各頁的內容高度不同，逐頁照截圖量。沒給＝不推
   */
  shift?: number
  /**
   * 用程式畫的視覺，取代這一頁的照片拼貼。
   * 'rings'＝一對婚戒的網點畫（歸零那頁）。沒給就照常排 photos 與 illustration。
   */
  visual?: 'rings'
  /** null＝這一頁沒有距離變化，線直接穿過 */
  marker: StoryMarker | null
  /** 線下方的年份或日期，空字串不顯示 */
  years: string
}

/** 書頁的一面：整面照片，四邊出血（object-fit: cover） */
export interface StoryBookPhotoPage {
  kind: 'photo'
  src: string
  alt: string
  /** 裁切重心（object-position 的百分比）。桌機頁比例與照片幾乎相同，主要管手機半屏的裁法：臉要留在框內 */
  focus?: { x: number, y: number }
  /**
   * 照片右側哪些角落是深色：疊在那裡的固定控制項要換成紙白（top＝右上的選單開關、bottom＝右下的「下一站」）。
   * 桌機看右面、手機看疊在上面的左面；沒給就是淺色照片，控制項維持墨色
   */
  darkCorners?: ('top' | 'bottom')[]
}

/** 書頁的一面：紙色文字頁。標題不在這裡——用跨頁的 title 排成 h2，同一個標題不寫兩次 */
export interface StoryBookCopyPage {
  kind: 'copy'
  /** 標題下的英文眉標（MEET THE GROOM）；空字串不排 */
  eyebrow: string
  /** 一行一段；空字串＝段落間距（與 StorySlide.lines 同一個約定） */
  lines: string[]
  /** 鋪滿整面的水彩插畫（素材自帶紙色底，貼底對齊），文字壓在它上方的留白。手機半屏塞不下，不顯示 */
  art?: { src: string, alt: string }
  /**
   * 標題上方的一張小插圖（去背），與標題、內文排成一組垂直置中。純裝飾（alt 空）：畫的是對頁照片的插畫版。
   * 只在桌機顯示——手機的文字面就疊在那張照片正上方，同一個畫面會連看兩次
   */
  vignette?: { src: string, width: number, height: number }
  /** 桌機文字塊離頁頂的百分比（照設計稿量）；沒給就垂直置中 */
  top?: number
}

export type StoryBookPage = StoryBookPhotoPage | StoryBookCopyPage

/**
 * 書的一個跨頁（第 7 頁之後那本會翻的書）。
 * 'pages'＝左右各一面；'bleed'＝一張橫式照片跨滿兩面（左面顯示左半、右面顯示右半）。
 * title 是這一跨的無障礙名稱與頁次軸標籤：有文字面的跨頁把它排成 h2，全出血的只給讀屏（sr-only）。
 */
export type StorySpread
  = | { kind: 'pages', key: string, title: string, left: StoryBookPage, right: StoryBookPage }
    | {
      kind: 'bleed'
      key: string
      title: string
      src: string
      alt: string
      /** 疊在左面左下角的活字：首屏那組「In Your Love」金箔字＋「I Shine」手寫字樣的紙白版。沒給就只有照片 */
      mark?: { title: string, script: string }
      /** 疊在左面左下角的幾行小字（海邊那跨的兩句），一行一段；與 mark 擇一 */
      caption?: string[]
      /** 同 StoryBookPhotoPage.darkCorners：右上／右下角是深色時，疊在上面的控制項換紙白 */
      darkCorners?: ('top' | 'bottom')[]
      /**
       * 桌機的裁切重心（object-position 的百分比）。照片 2880×2048（1.41:1）鋪滿 1440×900（1.6:1）的兩面時上下各裁 6%，
       * 人頭頂到照片上緣的那跨要把 y 壓到 0。手機是直式框、照片縮到與框同高，只有 x 有作用，沒給就是置中
       */
      focus?: { x: number, y: number }
    }

export interface StoryCat {
  key: string
  name: string
  nameEn: string
  /** 角色一句；可含 \n 換行（照新人給的斷行） */
  role: string
  /** 紙條上的話；可含 \n 換行 */
  line: string
  /**
   * 牠在三貓場景圖（StoryCatScene）裡的位置，單位皆為圖寬／圖高的百分比：
   * box 是整隻貓的命中框（左上角＋寬高），head 是頭頂中心——名字與羽毛落在這一點。數字用格線圖量出，見 docs §45
   */
  spot: {
    box: { x: number, y: number, w: number, h: number }
    head: { x: number, y: number }
  }
}

/** 三隻貓同框的場景圖（已去背）；三隻各自的位置寫在 StoryCat.spot */
export interface StoryCatScene {
  src: string
  alt: string
  width: number
  height: number
}

/**
 * 當天流程的一個時間點。
 * highlight 為真的那一個是**唯一要賓客行動的**（建議到場），其餘兩個是背景資訊；
 * 三個並排一樣大，賓客不知道該記哪一個，所以版面只放大這一個。
 */
export interface StoryScheduleStop {
  key: string
  /** 24 小時制，例：12:15 */
  time: string
  /** 這個時間點在做什麼，例：入席 */
  label: string
  /** 全組只有一個為 true */
  highlight?: boolean
}

/** 當天流程：三個時間點，順序即時間順序。日期不在這裡——婚宴資訊那一區（StoryVenue.dateTime）才有 */
export interface StoryScheduleContent {
  stops: StoryScheduleStop[]
}

/**
 * 著裝建議用的水彩插畫。原檔畫布四周有大片透明邊、四張長寬比又都不同，
 * 轉檔時已先裁到 alpha 邊界再縮圖，所以檔案尺寸就是實際看得到的圖。
 * width／height 是「顯示尺寸」（CSS px，檔案本身是 2 倍），
 * 四張的顯示尺寸經過視覺正規化，不是同一個數字——理由見 VenueInfo.vue 的註解。
 */
export interface StoryDressImage {
  src: string
  /** 寫實際看得到的東西（「香檳色緞帶打成的蝴蝶結」），不是寫顏色名 */
  alt: string
  width: number
  height: number
}

/** 一個色票：一張水彩插畫，配中文色名、英文色名、材質 */
export interface StoryDressSwatch {
  /** 中文色名，例：香檳 */
  name: string
  /** 英文色名，例：Champagne */
  nameEn: string
  /**
   * 這個顏色在新人心裡的材質，例：緞帶。新人原稿把材質列成底部第二份清單，
   * 但那等於同一組資訊在同一塊裡出現兩次；收進色票當第三行，色與材質才綁在一起看。
   */
  material: string
  /**
   * 婚禮指定的色碼。頁面不再渲染色塊——插畫已經把顏色與質感一起講完了，
   * 再擺一顆色點等於同一件事說兩次。欄位留著給印刷、小卡對色這類要精確值的場合。
   */
  hex: string
  image: StoryDressImage
}

/**
 * 著裝建議的手繪人物示意（女生洋裝／男生西裝）。
 * 新人還沒交圖，所以整組是選填、沒值就不渲染——之後補上內容層的值即可上線，版面不必再動。
 * width／height 是原圖尺寸，用來鎖長寬比，避免圖載入時整區跳動。
 */
export interface StoryDressFigure {
  src: string
  alt: string
  /** 圖下方一行標，例：Champagne 洋裝 */
  caption: string
  width: number
  height: number
}

/**
 * 著裝建議整塊：標題「服裝建議」＋英文小字＋中文導語一句＋四塊布片色票＋兩句結語。
 * 標題「服裝建議」寫死在元件裡；原稿的英文主標（Wear a Little Warmth）2026-09-15 拿掉，
 * 全頁區塊統一成「中文在上、英文小字在下」（§49）。
 */
export interface StoryDressCode {
  /** 標題底下的英文小字（Dress Code），版面上轉大寫顯示 */
  eyebrow: string
  /** 中文導語一句 */
  subtitle: string
  /** 中文副標與色票之間的一枝白色花草。它是一個標點不是一張圖，所以放很小 */
  flower?: StoryDressImage
  swatches: StoryDressSwatch[]
  /** 結語英文句（含新人原稿的 ♡，符號屬文案不是 icon） */
  closingEn: string
  /** 結語中文句：講清楚這是建議不是規定 */
  closing: string
  /** 手繪人物，尚未提供 */
  figures?: StoryDressFigure[]
}

/** 一條交通路線：起點（車站／交流道）配一句怎麼走 */
export interface StoryTransportRoute {
  /** 起點或方式，例：新竹站、計程車、國道一號 */
  label: string
  /** 怎麼走，一句講完；含公里數、車資、步行時間等新人給的數字 */
  detail: string
}

/** 一種交通方式：折疊面板的一格 */
export interface StoryTransportGroup {
  /** 折疊面板的 aria-controls／aria-labelledby 用它組 id，必須唯一 */
  key: string
  title: string
  /** 標題下的英文回音（參考站的雙語標題節奏） */
  titleEn: string
  /** 整組共通的補充（目前只有開車那組的停車折抵），空字串不顯示 */
  note: string
  routes: StoryTransportRoute[]
}

export interface StoryTransport {
  /**
   * 所有路線的共通下車點。新人原文每一條都把它再寫一次，
   * 提到最上面說一次，各條路線就只講「怎麼到這裡」。
   */
  dropOff: string
  groups: StoryTransportGroup[]
  /**
   * 查更多交通資訊的 LINE。已確認是新人自己的婚禮帳號（非場地客服），
   * 文案寫明歸屬，賓客才知道加了會問到人。
   */
  lineLabel: string
  lineUrl: string
}

/**
 * 場地照片。四個米白色票只答得出「什麼色」，答不出「這場有多正式、室內還是戶外」，
 * 照片補的正是缺的那一半。刻意只有兩張各司其職——一張是脈絡，一疊就變成場地廣告。
 */
export interface StoryVenuePhoto {
  src: string
  alt: string
  /** 照片下方的一行說明，跟著輪播換 */
  caption: string
}

export interface StoryVenue {
  /** 只有日期，不含時間——三個時間點歸 StoryScheduleContent，同一份資訊不在兩處各寫一次 */
  dateTime: string
  venueName: string
  hallName: string
  address: string
  /** 外連：手機點了會跳 Google 地圖 App 導航，嵌入地圖取代不了 */
  mapLink: string
  /** 嵌入用；maps.app.goo.gl 短網址不能塞 iframe，見 useStoryContent 的註解 */
  mapEmbed: string
  /** iframe 的無障礙名稱——沒有 title 的 iframe 讀屏使用者無法辨識 */
  mapTitle: string
  transport: StoryTransport
  /**
   * 地圖連結下方的場地照，在同一個框裡原地輪播（外觀＋廳內，新人 2026-09-15）。
   * 一張時就是靜態照片；照片規格一律 4:3、1200×900
   */
  photos: StoryVenuePhoto[]
  dressCode: StoryDressCode
}

/** 賓客照片收集：新人自己的雲端資料夾，婚禮當天才開 */
export interface StoryPhotoDrive {
  enabled: boolean
  url: string
  label: string
}

export interface StoryMusic {
  src: string
  /** 唱片托盤展開時顯示的曲名 */
  title: string
}

/**
 * 藏在花田裡的一隻貓（彩蛋）。
 * 兩張圖是同一叢花的兩個狀態：hide 只露耳朵、appear 整隻探出頭。
 * 素材各自帶著自己那叢花，而且兩態的花排法本來就不同，所以切換只能同位置交叉淡出，
 * 對不齊是素材決定的、不是實作沒對準（見 docs/public-landing-assets.md §23）。
 */
export interface StoryFlowerCat {
  /** 對應 StoryContent.cats 的 key；名字從那裡取，不在這裡再寫一份 */
  key: string
  name: string
  hide: string
  appear: string
  /**
   * 耳朵在整叢花外框裡的位置：中心點與視覺尺寸，單位皆為百分比。
   * 外框＝appear 那張的外框（兩態下緣對齊，appear 較高故以它為準），數字由 alpha 邊界框量出。
   */
  ear: { x: number, y: number, w: number, h: number }
}

/** 祝福花田的靜態素材：一條橫幅花田、藏在裡面的三隻貓，與花田上方新人畫的三朵花 */
export interface StoryFlowerField {
  /**
   * 三隻小貓坐在花叢裡的插畫。§23 起改由橫幅花田當這一區的主體，已不再渲染；
   * 素材與欄位留著，要換回來只需在 StoryFlowers 把它放回花田的位置。
   */
  centerArt: string
  centerAlt: string
  /** 花田上方的花，由左到右 */
  flowers: string[]
  /** 橫幅花田：這一區的底，三隻貓散布在上面 */
  banner: string
  bannerAlt: string
  /** 藏在花田裡的三隻貓，順序即由左到右的落點 */
  cats: StoryFlowerCat[]
}

export interface StoryContent {
  hero: StoryHeroContent
  slides: StorySlide[]
  /** 七頁之後的書：翻完才往下捲 */
  spreads: StorySpread[]
  cats: StoryCat[]
  catScene: StoryCatScene
  schedule: StoryScheduleContent
  flowerField: StoryFlowerField
  venue: StoryVenue
  photoDrive: StoryPhotoDrive
  /** 「期待與你相見」那區跟著游標冒出來的照片（長邊 320px 的小圖），依序輪流；空陣列＝不做 */
  trail: string[]
  music: StoryMusic
}
