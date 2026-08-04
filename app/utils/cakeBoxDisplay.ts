// 喜餅款式的顯示解析（issue #140）——接待台與後台共用一份組合款展開邏輯

import type { CakeBoxTypeListItem } from '~/types/api/cakebox'

type CakeBoxTypeMap = Map<string, CakeBoxTypeListItem>

// 縮圖與 hover 放大預覽共用的單位：一格＝一款實際要拿的盒子
export interface CakeBoxThumbItem {
  name: string
  url: string | null
}

// 內含單款之間的連接符。「＋」與其後的款名以不換行空格相黏，
// 窄容器換行時斷成「經典禮盒 / ＋ 輕巧禮盒」，而不是讓「＋」孤零零佔一行
// （需搭配呼叫端的 break-keep，否則中文會直接斷在詞中間）
const COMPONENT_JOINER = ' ＋ '

/**
 * 縮圖來源：組合款展開成內含各單款（看得出實際要拿幾盒）；
 * 非組合款、或內含款皆無圖時，退回款式自身。回傳含款名，供 hover 放大時標示哪張是哪款。
 */
export function cakeBoxThumbItems(type: CakeBoxTypeListItem, typeById: CakeBoxTypeMap): CakeBoxThumbItem[] {
  const components = (type.componentTypeIds ?? [])
    .map(id => typeById.get(id))
    .filter((t): t is CakeBoxTypeListItem => !!t)
    .map(t => ({ name: t.name, url: t.imageUrl }))

  // 內含款一張圖都沒有時退回自身，否則整格空白、hover 也沒東西可看
  if (components.some(c => c.url))
    return components

  return [{ name: type.name, url: type.imageUrl }]
}

/**
 * 接待台款式顯示：內含優先——主行是接待員實際要拿的盒子，組合款自訂名降為副標。
 * 組合只含一款時副標留空（否則同一件事講兩遍）。
 */
export function cakeBoxDisplayName(
  type: CakeBoxTypeListItem,
  typeById: CakeBoxTypeMap,
): { primary: string, secondary: string } {
  const componentNames = (type.componentTypeIds ?? [])
    .map(id => typeById.get(id)?.name ?? '')
    .filter(Boolean)

  if (!componentNames.length)
    return { primary: type.name, secondary: '' }

  return {
    primary: componentNames.join(COMPONENT_JOINER),
    secondary: componentNames.length > 1 ? type.name : '',
  }
}
