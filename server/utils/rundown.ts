// 流程列排序：time null（未定時段）置頂，其餘依 time 字串升冪；同時間維持原 seq 順序
export function sortRundownRows<T extends { time: string | null }>(rows: T[]): T[] {
  return rows.sort((a, b) => {
    if (a.time === null && b.time === null)
      return 0
    if (a.time === null)
      return -1
    if (b.time === null)
      return 1
    return a.time.localeCompare(b.time)
  })
}
