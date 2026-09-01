// 婚紗入口頁（/invite/[weddingId]）的場景物件型別。
// 入口頁是一張「喜帖桌面」平面稿的動態化：每個物件是一張去背圖，
// 以百分比座標散落在固定比例的舞台上。內容為單一婚禮的靜態資料，
// 非後台可編輯的實體，故與 app/types/story.ts 同樣不走 app/types/api/ 的 API 合約慣例。

/** 漂浮語彙：緞帶左右擺盪、葉片緩降、花瓣飄移、唱片自轉 */
export type SceneFloat = 'ribbon' | 'leaf' | 'petal' | 'spin'

/** 單一斷點下的擺放：x/y 為物件中心點佔舞台的百分比，w 為寬度佔舞台寬的百分比 */
export interface ScenePlacement {
  x: number
  y: number
  w: number
  rotate?: number
  /** 水平鏡射：素材是「單向」的美術資產（如緞帶），兩張稿走向相反時各自設定 */
  flip?: SceneFlip
}

/** 素材本身是「單向」的美術資產（如緞帶），鏡射成另一端造型時使用 */
export type SceneFlip = 'x'

/** hover／focus 的額外回饋：'wobble'＝像掛在迴紋針上被撥了一下，左右晃兩下就停 */
export type SceneHover = 'wobble'

/**
 * hover 時浮現在物件上的手寫小字。
 * 位置與傾角是「素材專屬幾何」（要貼齊拍立得那條白邊、要跟著它本身的傾斜），
 * 所以跟座標一樣住在 useInviteScene，不寫死在元件裡。
 */
export interface SceneCaption {
  /** 桌機版：hover／focus 時才浮現，一個元素一行，不自動斷行 */
  lines: string[]
  /** 手機版：常駐顯示（手機沒有 hover，藏起來等於沒有）。不給就在手機不出現 */
  mobileLines?: string[]
  /** 文字塊中心佔物件寬／高的百分比 */
  x: number
  y: number
  /** 文字塊寬度佔物件寬的百分比 */
  w: number
  /** 素材裡拍立得本身的傾角（度，正＝順時針） */
  rotate: number
  /** 字級佔物件寬的百分比——用 cqw，字會跟著物件一起縮放 */
  size: number
}

export interface SceneItem {
  key: string
  /** 去背圖路徑；素材尚未到位時留空字串，改渲染 placeholder 色塊 */
  src: string
  /** 裝飾物件一律空字串（同時 aria-hidden）；熱區給語意文字 */
  alt: string
  desktop: ScenePlacement
  /** null＝此物件在手機版不出現 */
  mobile: ScenePlacement | null
  /** 視差深度：0＝遠景不動，1＝近景位移最大 */
  depth: number
  /** 進場 stagger 序號（step 70ms） */
  order: number
  /** 疊放層級 */
  z: number
  float?: SceneFloat
  /** hover／focus 的額外回饋（預設只有浮起＋放大） */
  hover?: SceneHover
  caption?: SceneCaption
  /** 'slide-up'：進場時從自身高度下方滑出（愛心卡從信封裡抽出的效果），取代預設的單拍上浮 */
  entrance?: 'slide-up'
  /** 進場延遲的額外基準值（毫秒），疊加在 order*70ms 之上——用來把整個場景切成先後幾幕（信封／滑出／其餘物件） */
  phaseDelay?: number
  /** 有值＝可點擊熱區，導向此路徑 */
  to?: string
  /** 有值＝點擊後請對應的貓咪走進桌面（值為 SceneCat.key），再點一次收回 */
  cat?: string
  /**
   * 群組名：同組物件在該組熱區被 hover／focus 時一起做出反應。
   * 用於信封組——熱區在最前面的信封前片上（它的圖片矩形本來就蓋住愛心卡，
   * 透明像素一樣會攔截點擊），但視覺回饋要讓裡面的愛心卡一起浮起。
   */
  group?: string
  eager?: boolean
  /** true＝渲染為互動按鈕，由 InviteStage 統一處理背景音樂開關（目前只有金唱片用） */
  musicToggle?: boolean
}

export interface SceneBackground {
  /** 左上角葉影光斑底紋（鋪滿視窗） */
  shadow: string
  /** 右側葉影：只在桌機出現——手機稿右緣沒有留白可以放 */
  shadowRight: string
  /** 左下角蕾絲布邊 */
  lace: string
}

/** 開場：銀盤上一封封蠟的喜帖，點過才進到桌面場景 */
export interface SceneIntro {
  /** 鋪滿開場的花藝平鋪底圖（不透明；alpha 已在轉檔時壓在 paper 底色上，見 docs §18） */
  backdrop: string
  /** 銀盤 */
  tray: string
  /** 封蠟喜帖（點擊目標） */
  envelope: string
  /** 提示文字（同時是按鈕旁的可見標籤） */
  hint: string
}

/**
 * 貓咪來訪：三個腳印各對應一隻，點下去牠走進桌面趴著，旁邊落一張紙條。
 * 刻意不做成 modal——牠是桌上的一個物件，不是蓋在桌上的一層 UI。
 */
export interface SceneCat {
  /** 對應 SceneItem.cat */
  key: string
  name: string
  /** 紙條上的角色定位；一個元素一行，維持新人給的斷句不自動斷行 */
  role: string[]
  /** 紙條上的悄悄話；一個元素一行 */
  lines: string[]
  /** 紙條最後一行的祝福 */
  closing: string
  /** 去背照片 */
  photo: string
  /**
   * true＝素材原本臉朝右。三隻都趴在畫面右下角，臉要朝左才會看向畫面內側與紙條，
   * 朝右的就水平鏡射。王冠在頭頂正中、毛色沒有方向性，鏡射看不出來。
   */
  facesRight?: boolean
  /**
       趴／坐在桌上的寬度佔舞台寬的百分比。三隻姿勢不同（兩隻趴、一隻坐），
      照同一個寬度縮會讓坐著那隻高出一大截，故各自定值讓三隻的「高度」對齊
   */
  w: number
  mobileW: number
}

export interface SceneMusic {
  src: string
}

export interface InviteScene {
  background: SceneBackground
  /** 標題主視覺（花體字組，web font 無法重現故出圖） */
  titleAlt: string
  tagline: string[]
  taglineEn: string
  intro: SceneIntro
  cats: SceneCat[]
  /** 貓咪進場時一步一步浮現的腳印素材（三隻共用） */
  catTrail: string[]
  items: SceneItem[]
  music: SceneMusic
}
