// 把一段文字裡的阿拉伯數字切出來，讓模板能給數字套襯線展示字體（Cormorant），中文維持 Noto Serif TC。
// 「2025.05.21」「2015 – 2016」這類帶分隔符的數字保持成一段；沒有數字時回傳單一段。
export interface TextRun {
  text: string
  digit: boolean
}

/** 切割用：整段數字（含中間的 . , :）當一個群組，split 會把群組留在結果裡 */
const NUMBER_RUN = /(\d+(?:[.,:]\d+)*)/
const STARTS_WITH_DIGIT = /^\d/

export function splitDigits(text: string): TextRun[] {
  return text
    .split(NUMBER_RUN)
    .filter(Boolean)
    .map(part => ({ text: part, digit: STARTS_WITH_DIGIT.test(part) }))
}
