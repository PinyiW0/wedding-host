// 婚禮 mock 資料
// seed：wedding-001（王小明與李小美的婚禮 / 台北君悅酒店 / 2026-10-10）

export interface MockWedding {
  weddingId: string
  title: string
  venue: string
  address: string
  date: string
  mapLink: string | null
  parkingInfo: string | null
  transportInfo: string | null
  deletedAt: string | null
}

export const mockWeddings: MockWedding[] = [
  {
    weddingId: 'wedding-001',
    title: '王小明與李小美的婚禮',
    venue: '台北君悅酒店',
    address: '台北市信義區松壽路2號',
    date: '2026-10-10',
    mapLink: null,
    parkingInfo: null,
    transportInfo: null,
    deletedAt: null,
  },
  { weddingId: 'wedding-002', title: '張志豪與陳怡君的婚禮', venue: '台中林酒店', address: '台中市西區公益路二段111號', date: '2026-09-20', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
  { weddingId: 'wedding-003', title: '林建宏與黃淑芬的婚禮', venue: '高雄漢來大飯店', address: '高雄市前金區成功一路266號', date: '2026-11-15', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
  { weddingId: 'wedding-004', title: '吳俊傑與劉雅婷的婚禮', venue: '台北寒舍艾美酒店', address: '台北市信義區松仁路38號', date: '2026-12-05', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
  { weddingId: 'wedding-005', title: '蔡明哲與許美玲的婚禮', venue: '桃園古華花園飯店', address: '桃園市中壢區民權路398號', date: '2027-01-10', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
  { weddingId: 'wedding-006', title: '鄭文彬與楊雅雯的婚禮', venue: '新竹喜來登大飯店', address: '新竹縣竹北市光明六路東一段265號', date: '2027-02-14', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
  { weddingId: 'wedding-007', title: '謝宗翰與周佳穎的婚禮', venue: '台南大億麗緻酒店', address: '台南市中西區西門路一段660號', date: '2027-03-08', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
  { weddingId: 'wedding-008', title: '洪志偉與何雅琪的婚禮', venue: '台北晶華酒店', address: '台北市中山區中山北路二段39巷3號', date: '2027-04-18', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
  { weddingId: 'wedding-009', title: '徐國強與曾淑惠的婚禮', venue: '宜蘭礁溪老爺酒店', address: '宜蘭縣礁溪鄉大忠村五峰路69號', date: '2027-05-22', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
  { weddingId: 'wedding-010', title: '高俊銘與郭佩珊的婚禮', venue: '花蓮翰品酒店', address: '花蓮縣花蓮市永興路2號', date: '2027-06-12', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
  { weddingId: 'wedding-011', title: '葉冠廷與賴怡安的婚禮', venue: '台北圓山大飯店', address: '台北市中山區中山北路四段1號', date: '2027-07-25', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
  { weddingId: 'wedding-012', title: '廖偉誠與范曉雯的婚禮', venue: '日月潭涵碧樓', address: '南投縣魚池鄉中興路142號', date: '2027-08-30', mapLink: null, parkingInfo: null, transportInfo: null, deletedAt: null },
]
