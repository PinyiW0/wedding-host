// 測試帳號（來源：spec/ui-config/ui-config.yaml > testAccounts）
export const TestUsers = {
  admin: { account: 'Andrea', password: 'Andrea1122', role: '管理者' },
  receptionist: { account: 'receptionist', password: 'star1122', role: '接待員' },
} as const

// 路由（來源：spec/report/route-map.yaml > routes）
export const Routes = {
  home: '/',
  login: '/login',
  register: '/register',
  weddings: '/weddings',
  weddingDetail: (weddingId: string) => `/weddings/${weddingId}`,
} as const
