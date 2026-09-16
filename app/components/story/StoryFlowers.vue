<!-- app/components/story/StoryFlowers.vue — 祝福花田＋出席回覆入口：RSVP 時畫的小花長在這裡，回覆喜帖就是種下你的那一朵。
     畫面是一張定格：花田橫幅上方可以排新人畫的小花（高低、大小、傾角錯落），
     指到（桌機游標／鍵盤）或點開（手機）一朵，那朵晃一下，背後探出一張手寫小紙條。
     三朵花 2026-09-15 曾拿掉（蠟筆筆觸與水彩花田不合）、09-16 新人要求放回；內容層 flowers 清空時那一排只剩 live region。
     花田裡另外藏了三隻貓（彩蛋）：預設只露耳朵，點耳朵才把那隻找出來，三隻都找到才出現結語。
     賓客的花目前不在這一段排開（新人指定「先放三朵」），2026-09-06 起連「看整片花田」也拿掉了，
     所以這一區已經不碰花田 API、不指向賓客畫的花；整片花田仍由 PublicMenu 的「祝福花田」進得去。 -->
<script setup lang="ts">
import type { StoryFlowerCat, StoryFlowerField } from '~/types/story'

const props = defineProps<{
  field: StoryFlowerField
  rsvpTo: string
  rsvpLabel: string
}>()

/** 紙條上的一句話。只寫一次，讀屏那份與畫面那份共用同一個字串 */
const NOTE_TEXT = '要幸福唷！'

/** 三隻都找到才出現的結語（新人指定文案，兩行照這樣斷） */
const EPILOGUE = [
  '謝謝你逛到花田最深處。',
  '三位小主人批准你參加婚禮了 ♡',
]

/** 對話框停留多久（毫秒）：夠讀完六個字，又不會三張一起掛在花田上 */
const BUBBLE_MS = 2800

/** 判斷名字的頭尾是不是英數字（Happy 要補空白、錢錢不用） */
const LATIN = /[a-z0-9]/i

/** 三朵花的錯落：寬度、抬高多少（底邊對齊後加 margin-bottom）、傾角、紙條的傾角，由左到右。第四朵以後沿用最後一組。
    抬高用 margin 不用 translate：搖曳動畫寫在 translate 上，同一個屬性會互相覆蓋 */
const ARRANGE = [
  // 尺寸是原本的四分之一（80/96→20/24、112/128→28/32）：加了花田橫幅之後，
  // 手繪的三朵花跟水彩花田筆觸不同，原本的大小會互相搶，縮成小綴飾才不突兀。
  // 抬高的 margin 一起照四分之一縮，否則位移會比花本身還高
  { size: 'w-5 sm:w-7', lift: 'mb-0', rotate: '-rotate-6', sway: '5.2s', noteRot: '-4deg' },
  { size: 'w-6 sm:w-8', lift: 'mb-1.5 sm:mb-2', rotate: 'rotate-3', sway: '6.1s', noteRot: '3deg' },
  { size: 'w-5 sm:w-7', lift: 'mb-0.5 sm:mb-1', rotate: 'rotate-6', sway: '5.6s', noteRot: '-3deg' },
]

/* 冒出紙條的那一朵：兩條通道。
   hovered＝游標指著或鍵盤停在上面（離開就收），picked＝手指點開的那一朵（再點一次才收）。
   游標優先，語彙照 StoryHeroRing 的 onEnter／onLeave。 */
const hovered = ref<number | null>(null)
const picked = ref<number | null>(null)
const shown = computed(() => hovered.value ?? picked.value)

function onEnter(index: number, event: PointerEvent) {
  if (event.pointerType !== 'touch')
    hovered.value = index
}
function onLeave(index: number) {
  if (hovered.value === index)
    hovered.value = null
}
/** 鍵盤停上來才冒紙條：滑鼠按下去帶進來的 focus 交給 hover／click 管，不要點一下冒兩次 */
function onFocus(index: number, event: FocusEvent) {
  if ((event.target as HTMLElement).matches(':focus-visible'))
    hovered.value = index
}
/** 手機：同一朵再點一次收回，點另一朵換過去。
    只認手指——桌機游標與鍵盤各自有 hovered 那條通道，再存一份會在移開後把紙條留在畫面上 */
function onPick(index: number, event: PointerEvent) {
  if (event.pointerType !== 'touch')
    return
  picked.value = picked.value === index ? null : index
}

/* ── 花田彩蛋：找出藏在花裡的三隻貓 ── */

/** 三叢貓花在花田上的落點：左／中／右，寬度與離花田底部的高度都錯開，
    排成一列一樣大就一眼看穿是三個按鈕，彩蛋就不是彩蛋了。
    中間那隻（肥肥）站得特別高：牠的耳朵是淡粉色，埋在花田裡跟粉玫瑰完全分不出來，
    要抬到花田的輪廓線附近、讓耳朵映在米色背景上才找得到。
    手機是另一套數字：手機把花田橫幅放大到 165%（兩端裁掉），貓才不會小到耳朵按不到；
    放大後可見範圍只剩花田的 20%～80%，所以三隻要往中間收。實測命中框見 docs §23 */
const CAT_ARRANGE = [
  { left: '19%', width: '26%', bottom: '3%', leftSm: '1%', widthSm: '33%', bottomSm: '2%', noteRot: '-3deg' },
  { left: '40%', width: '24%', bottom: '52%', leftSm: '37%', widthSm: '28%', bottomSm: '36%', noteRot: '2.5deg' },
  { left: '58%', width: '21%', bottom: '12%', leftSm: '70%', widthSm: '25%', bottomSm: '6%', noteRot: '-2deg' },
]

/** 已經找到的貓。刻意只放記憶體：這是一次逛頁面的彩蛋，重整歸零沒關係，不寫 localStorage */
const foundKeys = ref<string[]>([])
/** 正在冒對話框的那一隻（幾秒後自己收），與「找到」是兩回事——找到就不會再變回去 */
const talkingKey = ref<string | null>(null)
/** 讀屏要播的那一句。用 ref 不用 computed：只在「剛找到」的當下播一次，之後靜音，不隨狀態反覆重播 */
const catAnnounce = ref('')
let bubbleTimer: ReturnType<typeof setTimeout> | undefined

const allFound = computed(() => foundKeys.value.length === props.field.cats.length)

/** 讀屏只有這一個 live region（花朵紙條那次加的）：花的紙條、找到貓、結語共用，同時只播一件事 */
const liveMessage = computed(() => {
  if (catAnnounce.value)
    return catAnnounce.value
  return shown.value === null ? '' : NOTE_TEXT
})

function isFound(key: string) {
  return foundKeys.value.includes(key)
}

/** 「你找到○○了」。名字是英文時前後補半形空白（你找到 Happy 了），中文名字不補 */
function foundText(name: string) {
  const head = LATIN.test(name.slice(0, 1)) ? ' ' : ''
  const tail = LATIN.test(name.slice(-1)) ? ' ' : ''
  return `你找到${head}${name}${tail}了`
}

function onFindCat(cat: StoryFlowerCat) {
  // 對話框每次點都重新冒出來（已找到的貓再點也給回饋），但 foundKeys 只進不出
  talkingKey.value = cat.key
  if (bubbleTimer)
    clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => {
    talkingKey.value = null
    catAnnounce.value = ''
  }, BUBBLE_MS)

  if (isFound(cat.key))
    return
  foundKeys.value = [...foundKeys.value, cat.key]
  // 找齊的那一下把結語一起播掉：結語是視覺上另外浮出的一塊，讀屏沒有第二個 live region 可用
  catAnnounce.value = allFound.value
    ? `${foundText(cat.name)}。${EPILOGUE.join('')}`
    : foundText(cat.name)
}

/** 游標移上耳朵時整叢花輕輕晃一下——「這裡可以點」的線索。
    耳朵是圖的一部分沒辦法單獨動，晃整叢花跟上面三朵花的互動是同一套語彙 */
const nudgedKey = ref<string | null>(null)
function onCatEnter(key: string, event: PointerEvent) {
  if (event.pointerType !== 'touch')
    nudgedKey.value = key
}
/** 鍵盤停上來也給同一個線索；滑鼠按下去帶進來的 focus 交給 hover 那條通道，不要點一下晃兩次 */
function onCatFocus(key: string, event: FocusEvent) {
  if ((event.target as HTMLElement).matches(':focus-visible'))
    nudgedKey.value = key
}
function onCatLeave(key: string) {
  if (nudgedKey.value === key)
    nudgedKey.value = null
}

onBeforeUnmount(() => {
  if (bubbleTimer)
    clearTimeout(bubbleTimer)
})
</script>

<template>
  <section aria-labelledby="story-flowers-title" class="bg-paper px-6 py-20 text-center lg:py-28">
    <div class="mx-auto max-w-3xl">
      <!-- 標題 2026-09-15 改成「中文大標在上、英文回音在下」，與婚宴資訊、當天流程同一套
           （原本是中文小眉標＋英文大標，全頁只有這裡與著裝建議反著走）。
           中文大標比照 VenueInfo 的場館名（text-h2 semibold），英文回音是一行金色小型大寫 -->
      <h2 id="story-flowers-title" class="font-serif-tc text-h2 font-semibold text-ink">
        祝福花田
      </h2>
      <p class="mt-3 text-overline uppercase text-gold-deep">
        Where Your Wishes Bloom
      </p>
      <!-- 四行斷行是新人指定的，一行一個 block 自己斷；390px 下每行都排得進 px-6 的內寬，不會二次折行。
           內文與全頁其他段落同用 Noto Serif TC（09-15 前是無襯線，全頁唯一一處） -->
      <p class="mt-6 font-serif-tc text-body text-ink-500">
        <span class="block">每一朵花，都來自一份祝福。</span>
        <span class="block">謝謝你們在我們的故事裡，種下一點點美好。</span>
        <span class="block">有些是花、有些是葉子，</span>
        <span class="block">放在一起，就成了我們最喜歡的一片花田。</span>
      </p>

      <div class="mt-12">
        <!-- 三朵花：底邊對齊再各自上下位移，花在花田前面一層、稍微壓到花田頂端。
             加了互動就不再是純裝飾，所以每朵包成真的 button、拿掉整排的 aria-hidden -->
        <!-- 間距沒有跟著縮到四分之一：花只剩 20px，命中框要撐到 24px 寬才過得了 WCAG 2.5.8，
             間距太小相鄰的命中框會疊在一起、點到隔壁那朵 -->
        <div class="relative z-10 mx-auto flex max-w-md items-end justify-center gap-2 sm:gap-3">
          <!-- 這一區唯一的 live region：花的紙條、找到貓、結語都從這裡播。
               三張紙條各自朗讀會把同一句話唸三次，所以只留這一份 -->
          <p class="sr-only" aria-live="polite">
            {{ liveMessage }}
          </p>
          <button
            v-for="(src, i) in field.flowers"
            :key="src"
            type="button"
            class="flower-btn relative flex rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep"
            :class="[ARRANGE[i]?.lift ?? '', { 'is-on': shown === i }]"
            :style="{ '--note-rot': ARRANGE[i]?.noteRot ?? '-4deg' }"
            :aria-label="`第 ${i + 1} 朵祝福小花`"
            :aria-pressed="shown === i"
            @pointerenter="onEnter(i, $event)"
            @pointerleave="onLeave(i)"
            @focus="onFocus(i, $event)"
            @blur="onLeave(i)"
            @click="onPick(i, $event)"
          >
            <img
              :src="src"
              alt=""
              loading="lazy"
              class="flower h-auto drop-shadow-sm"
              :class="[ARRANGE[i]?.size ?? ARRANGE.at(-1)!.size, ARRANGE[i]?.rotate ?? '']"
              :style="{ '--sway-dur': ARRANGE[i]?.sway ?? '5.5s', '--sway-delay': `${i * 0.7}s` }"
            >
            <span class="note pointer-events-none absolute whitespace-nowrap rounded-sm px-3 py-2 font-hand text-body-l leading-none text-ink-700" aria-hidden="true">
              {{ NOTE_TEXT }}
            </span>
          </button>
        </div>

        <!-- 花田橫幅＋藏在裡面的三隻貓。
             overflow-hidden 是給手機用的：手機把整條花田放大到 165%，超出畫面的兩端裁掉、不產生橫向捲動。
             手機再用 -mx-6 頂掉 section 的左右內距：花田切在螢幕邊而不是內距邊，才讀得出「花田還延伸出去」。
             stage 的 padding-top 留給對話框，裁切才不會把冒出來的紙條切掉 -->
        <div class="cat-field -mx-6 sm:mx-0" :class="{ 'has-flowers': field.flowers.length > 0 }">
          <div class="cat-stage">
            <div class="relative">
              <img
                :src="field.banner"
                :alt="field.bannerAlt"
                loading="lazy"
                class="block w-full"
                width="1280"
                height="485"
              >
              <div
                v-for="(cat, i) in field.cats"
                :key="cat.key"
                class="cat"
                :class="{ 'is-found': isFound(cat.key), 'is-talking': talkingKey === cat.key, 'is-nudged': nudgedKey === cat.key }"
                :style="{
                  '--l': CAT_ARRANGE[i]?.left ?? '20%',
                  '--w': CAT_ARRANGE[i]?.width ?? '24%',
                  '--b': CAT_ARRANGE[i]?.bottom ?? '6%',
                  '--l-sm': CAT_ARRANGE[i]?.leftSm ?? '20%',
                  '--w-sm': CAT_ARRANGE[i]?.widthSm ?? '28%',
                  '--b-sm': CAT_ARRANGE[i]?.bottomSm ?? '6%',
                  '--ear-x': `${cat.ear.x}%`,
                  '--ear-y': `${cat.ear.y}%`,
                  '--ear-w': `${cat.ear.w}%`,
                  '--ear-h': `${cat.ear.h}%`,
                  '--note-rot': CAT_ARRANGE[i]?.noteRot ?? '-3deg',
                }"
              >
                <!-- appear 在流內：它比較高，由它決定整叢花的框，hide 再貼著框底疊上去。
                     兩張的花叢已在轉檔時裁成等寬、內容下緣貼齊下緣，所以這裡只要同寬同底就對得上 -->
                <img :src="cat.appear" alt="" loading="lazy" class="cat-appear block w-full">
                <span class="cat-hide">
                  <img :src="cat.hide" alt="" loading="lazy" class="block w-full">
                </span>
                <!-- 點的是耳朵不是整叢花，整叢可點就沒有「找到」的感覺。
                     視覺上就耳朵那麼大，命中框用 max() 撐到至少 44px（WCAG 2.5.8 下限 24px，靠發現的目標放寬到 44） -->
                <button
                  type="button"
                  class="cat-ear rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
                  :aria-label="isFound(cat.key) ? `已找到${cat.name}` : '花叢裡藏著一隻貓，點開看看是誰'"
                  @pointerenter="onCatEnter(cat.key, $event)"
                  @pointerleave="onCatLeave(cat.key)"
                  @focus="onCatFocus(cat.key, $event)"
                  @blur="onCatLeave(cat.key)"
                  @click="onFindCat(cat)"
                />
                <span
                  class="cat-bubble whitespace-nowrap rounded-sm px-3 py-2 font-hand text-body-l leading-none text-ink-700"
                  aria-hidden="true"
                >
                  {{ foundText(cat.name) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 彩蛋的一句提示（2026-09-16 新人：「擔心賓客不知道怎麼用」）：沒有這句，只露耳朵的三隻貓沒人會去點。
             壓成最低層級的附註字（caption、ink-300），提示在、但不跟花田搶 -->
        <p class="mt-4 font-serif-tc text-caption text-ink-300">
          花叢裡藏著三隻貓，找找牠們的耳朵。
        </p>

        <!-- 結語：三隻都找到才出現。放在花田下方、對話框都在花田裡，兩者不會互相蓋到 -->
        <p v-if="allFound" class="epilogue mx-auto mt-8 w-fit max-w-sm rounded-sm px-6 py-5 font-hand text-body-l leading-relaxed text-ink-700">
          <span v-for="line in EPILOGUE" :key="line" class="block">{{ line }}</span>
        </p>
      </div>

      <!-- 出席回覆前先講清楚按下去會發生什麼：回覆表單裡有「畫一朵小花給新人們」那一題（RsvpForm），
           上面四行講的「每一朵花都來自一份祝福」就是指這個。少了這句，賓客看到花田只會以為是裝飾 -->
      <p class="mt-12 font-serif-tc text-body text-ink-500">
        <span class="block">回覆出席時，也畫一朵屬於你的花，</span>
        <span class="block">種進這片花田。</span>
      </p>

      <!-- 出席回覆：說故事頁自己的話。原本是全頁唯一一顆實心膠囊，讀起來像從別的網站貼過來的元件（新人：「太突兀不搭」）。
           改成故事頁那組車票按鈕的語彙——一條金線往右走，末端一顆金圓章配箭頭，標籤是襯線寬字距；
           但這顆是轉換用的主行動，不是翻頁控制，所以標籤從 text-caption 放大到 text-h3、圓章也大一階。
           金線末端接按鈕正是這一頁的骨架（首屏的訊號線、各頁的時間軸都是這樣收尾），不必再造第二種按鈕形狀。
           標籤用 ink 不用金色：gold-deep 對紙白也只有 3.71:1，撐不起一般字級的 4.5:1。 -->
      <div class="mt-5 flex justify-center">
        <NuxtLink
          :to="rsvpTo"
          class="group flex w-full max-w-sm items-center gap-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep"
        >
          <span class="font-serif-tc text-h3 tracking-widest text-ink">{{ rsvpLabel }}</span>
          <span class="h-px flex-1 bg-gold-light" aria-hidden="true" />
          <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-deep text-paper transition-colors duration-250 group-hover:bg-gold">
            <svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 一朵花身上有三種變形，各自寫在不同的屬性才不會互相蓋掉——瀏覽器會把三者合成起來：
     rotate    ＝ Tailwind class 給的靜態傾角（-rotate-6 等）
     translate ＝ 微風搖曳（沿用 FlowerField 的語彙，三朵各自不同週期與相位）
     transform ＝ 指到時的晃動（見 .is-on）
   同一個屬性上動畫一律蓋掉其他宣告：晃動寫進 rotate 傾角會消失、寫進 translate 微風會消失。
   支點放莖底，晃起來像莖在擺而不是整朵平移。reduced-motion 由全域 guard 收掉。 */
.flower {
  transform-origin: bottom center;
  animation: flower-sway var(--sway-dur, 5.5s) ease-in-out var(--sway-delay, 0s) infinite alternate;
}
@keyframes flower-sway {
  from {
    translate: 0 0;
  }
  to {
    /* 花縮成四分之一之後，原本的 5px 佔掉花身四分之一高、看起來像在跳，跟著縮到 2px */
    translate: 0 -2px;
  }
}

/* 花只有 20～32px 寬，圖本身當命中框會小於 WCAG 2.5.8 的 24×24。
   用虛擬元素把命中框撐到 28×44，它是絕對定位所以不影響排版，也不會把相鄰兩朵推開 */
.flower-btn::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100%;
  height: 100%;
  min-width: 1.75rem;
  min-height: 2.75rem;
  translate: -50% -50%;
}

/* 指到（或點開）那一朵時左右晃一下。搖曳維持動畫列表的第一順位，加上晃動不會讓它從頭重跑 */
.flower-btn.is-on .flower {
  animation:
    flower-sway var(--sway-dur, 5.5s) ease-in-out var(--sway-delay, 0s) infinite alternate,
    flower-wiggle 400ms var(--ease-standard);
}
@keyframes flower-wiggle {
  25% {
    transform: rotate(-6deg);
  }
  60% {
    transform: rotate(4deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

/* 手寫紙條：紙紋沿用 StoryCats／StoryHero 那張 note-paper（同一頁本來就載了，等於不花額外流量），
   尺寸縮到只裝一句話。收著的時候往下藏 0.75rem、z-index 壓在花後面，冒出來就像從花背後探出頭。
   位移合進 translate（本來就要 -50% 置中），傾角走 rotate，兩個屬性各自獨立不互相覆蓋。
   進場慢一點（400ms、emphasized）、收回快一點（250ms、standard），跟首屏那張便簽同一組手感 */
.note {
  bottom: 100%;
  left: 50%;
  z-index: -1;
  margin-bottom: 0.25rem;
  translate: -50% 0.75rem;
  rotate: var(--note-rot, -4deg);
  opacity: 0;
  background: url("/images/invite/note-paper.webp") center / cover;
  box-shadow:
    0 1px 1px rgb(17 17 17 / 6%),
    0 8px 18px rgb(17 17 17 / 12%);
  transition:
    opacity 250ms var(--ease-standard),
    translate 250ms var(--ease-standard);
}
.flower-btn.is-on .note {
  translate: -50% 0;
  opacity: 1;
  transition:
    opacity 400ms var(--ease-standard),
    translate 400ms var(--ease-emphasized);
}

/* ── 花田橫幅與藏在裡面的三隻貓 ── */

/* 手機把花田放大到 165%：不放大的話整條 2.6:1 的橫幅縮到 342px 寬，貓的耳朵會小到按不到。
   放大後兩端超出畫面，overflow 裁掉（頁面不會多出橫向捲動）；
   margin-top 扣掉 headroom，對話框的空間才不會把花田往下推。 */
.cat-field {
  --stage-w: 165%;
  /* 給對話框的上方空間；margin-top 再扣掉同一個值，所以調 headroom 不會改變花田的位置 */
  --headroom: 4rem;

  margin-top: calc(var(--headroom) * -1);
  overflow: hidden;
}
/* 有花時再多拉 1rem，花田壓住三朵花的莖底。
   沒有花（2026-09-15 起內容層清空）就不拉：上面那排只剩 sr-only 的 live region，多拉會讓花田貼上內文 */
.cat-field.has-flowers {
  margin-top: calc(-1rem - var(--headroom));
}
.cat-stage {
  width: var(--stage-w);
  /* 放大後靠 margin 置中：width 已超過 100%，margin auto 在這種情況會算成 0 */
  margin-left: calc((100% - var(--stage-w)) / 2);
  /* 留給對話框的上方空間，否則 overflow 會把冒出來的紙條切掉 */
  padding-top: var(--headroom);
}
@media (min-width: 640px) {
  .cat-field {
    --stage-w: 100%;
  }
}

/* 一叢貓花：整塊不吃點擊（只有耳朵那顆 button 吃），
   花叢之間本來就會互相重疊，讓上面那叢擋掉下面那叢的耳朵就抓不到貓了 */
.cat {
  position: absolute;
  left: var(--l);
  bottom: var(--b);
  width: var(--w);
  pointer-events: none;
}
@media (min-width: 640px) {
  .cat {
    left: var(--l-sm);
    bottom: var(--b-sm);
    width: var(--w-sm);
  }
}

/* hide 貼著 appear 的框底疊上去：兩張在轉檔時已裁成花叢等寬、花叢置中、內容下緣貼齊裁切框下緣，
   所以同寬同底就會落在同一個位置。兩態的花本來就排得不一樣，切換時像花叢晃了一下，貓從裡面冒出來 */
.cat-hide {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  transition: opacity 250ms var(--ease-standard);
}
.cat-appear {
  transform-origin: bottom center;
  opacity: 0;
}
.cat.is-found .cat-hide {
  opacity: 0;
}
.cat.is-found .cat-appear {
  animation: cat-pop 400ms var(--ease-emphasized) both;
}
@keyframes cat-pop {
  from {
    translate: 0 6%;
    scale: 0.94;
    opacity: 0;
  }
  to {
    translate: 0 0;
    scale: 1;
    opacity: 1;
  }
}

/* 游標／鍵盤停在耳朵上時整叢花晃一下。
   hide 那張身上沒有別的動畫，所以晃動可以直接寫 transform，不會蓋掉誰 */
.cat.is-nudged .cat-hide img {
  transform-origin: bottom center;
  animation: cat-peek 400ms var(--ease-standard);
}
@keyframes cat-peek {
  30% {
    transform: rotate(-2.5deg);
  }
  65% {
    transform: rotate(1.5deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

/* 耳朵的命中框：位置與視覺尺寸都是量出來的百分比，
   但小螢幕上耳朵只有 20 幾 px 高，所以用 max() 把命中框撐到至少 44px——看得到的還是耳朵那麼大 */
.cat-ear {
  position: absolute;
  top: var(--ear-y);
  left: var(--ear-x);
  width: max(44px, var(--ear-w));
  height: max(44px, var(--ear-h));
  translate: -50% -50%;
  pointer-events: auto;
}

/* 對話框：紙紋與手寫字沿用同一頁的 note-paper 語彙（花朵紙條、StoryCats、StoryHero 都是這一套）。
   位移合進 translate（本來就要 -50% 置中），傾角走 rotate，兩個屬性各自獨立不互相覆蓋 */
.cat-bubble {
  position: absolute;
  bottom: 100%;
  left: var(--ear-x);
  margin-bottom: 0.5rem;
  translate: -50% 0.5rem;
  rotate: var(--note-rot, -3deg);
  opacity: 0;
  background: url("/images/invite/note-paper.webp") center / cover;
  box-shadow:
    0 1px 1px rgb(17 17 17 / 6%),
    0 8px 18px rgb(17 17 17 / 12%);
  transition:
    opacity 250ms var(--ease-standard),
    translate 250ms var(--ease-standard);
}
.cat.is-talking .cat-bubble {
  translate: -50% 0;
  opacity: 1;
  transition:
    opacity 400ms var(--ease-standard),
    translate 400ms var(--ease-emphasized);
}

/* 結語：同一套紙條，字置中、行距放寬，出現時淡入不推版面（v-if 掛上就跑一次） */
.epilogue {
  background: url("/images/invite/note-paper.webp") center / cover;
  box-shadow:
    0 1px 1px rgb(17 17 17 / 6%),
    0 12px 26px rgb(17 17 17 / 12%);
  rotate: -1.5deg;
  animation: epilogue-in 400ms var(--ease-emphasized) both;
}
@keyframes epilogue-in {
  from {
    translate: 0 8px;
    opacity: 0;
  }
  to {
    translate: 0 0;
    opacity: 1;
  }
}
</style>
