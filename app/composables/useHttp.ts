import type { AsyncData, UseFetchOptions } from 'nuxt/app'
import type { FetchError, FetchOptions } from 'ofetch'
import type { MaybeRefOrGetter } from 'vue'

// path 佔位符（:id 或 {id}）對應的實際值
export type PathParams = Record<string, string | number>

// reactive 讀取（useFetch）選項：baseURL 由 useHttp 統一帶入、method 固定，故移除
// default 在此覆寫：UseFetchOptions<T> 的 default 泛型在巢狀包裝下會塌成 Ref<undefined>，改以 () => T 收斂
export type HttpGetOptions<T> = Omit<UseFetchOptions<T>, 'baseURL' | 'method' | 'default'> & {
  pathParams?: PathParams
  default?: () => T
}

// imperative 讀取 / 寫入（$fetch）選項：同上
export type HttpRequestOptions = Omit<FetchOptions, 'baseURL' | 'method'> & {
  pathParams?: PathParams
}

type ImperativeMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const colonParam = /:(\w+)/g
const braceParam = /\{(\w+)\}/g

// 將 /users/:id、/users/{id} 內的佔位符換成實際值；未提供的佔位符原樣保留（方便發現漏帶參數）
function withPathParams(url: string, params?: PathParams): string {
  if (!params)
    return url
  return url
    .replace(colonParam, (match, key: string) =>
      key in params ? encodeURIComponent(String(params[key])) : match)
    .replace(braceParam, (match, key: string) =>
      key in params ? encodeURIComponent(String(params[key])) : match)
}

/**
 * 統一 API 入口：所有呼叫共用 runtimeConfig.public.apiBase 這個 domain。
 *
 * - get：走 useFetch，回 AsyncData（reactive 讀取，需在 setup 內呼叫；url 可傳 getter，ref 變動自動重抓）
 * - getOnce：走 $fetch，回 Promise（imperative 讀取，如 Blob 下載、event handler 內抓一次）
 * - post/put/patch/delete：走 $fetch，回 Promise（寫入）
 *
 * @example
 * const http = useHttp()
 * const { data } = http.get<User[]>('/users', { query: { page: 1 } })
 * const { data: user } = http.get<User>(() => `/users/${id.value}`)
 * const blob = await http.getOnce<Blob>('/reports/{id}/export', { pathParams: { id }, responseType: 'blob' })
 * await http.post<User>('/users', { body: { name } })
 * await http.delete('/users/:id', { pathParams: { id } })
 */
export function useHttp() {
  const baseURL = useRuntimeConfig().public.apiBase

  // reactive 讀取：useFetch；url 傳 getter 時 ref 變動會自動重抓
  function get<T>(url: MaybeRefOrGetter<string>, options?: HttpGetOptions<T>) {
    const { pathParams, ...rest } = options ?? {}
    // useFetch 泛型包裝的已知型別限制：不帶 <T>、改以斷言收斂 options 與回傳（沿用參考專案做法）
    return useFetch(() => withPathParams(toValue(url), pathParams), {
      baseURL,
      ...rest,
    } as unknown as UseFetchOptions<unknown>) as AsyncData<T | undefined, FetchError | undefined>
  }

  // imperative：$fetch（getOnce 與寫入共用）
  function request<T>(method: ImperativeMethod, url: string, options?: HttpRequestOptions) {
    const { pathParams, ...rest } = options ?? {}
    return $fetch<T>(withPathParams(url, pathParams), {
      baseURL,
      method,
      ...rest,
    })
  }

  return {
    get,
    getOnce: <T>(url: string, options?: HttpRequestOptions) => request<T>('GET', url, options),
    post: <T>(url: string, options?: HttpRequestOptions) => request<T>('POST', url, options),
    put: <T>(url: string, options?: HttpRequestOptions) => request<T>('PUT', url, options),
    patch: <T>(url: string, options?: HttpRequestOptions) => request<T>('PATCH', url, options),
    delete: <T>(url: string, options?: HttpRequestOptions) => request<T>('DELETE', url, options),
  }
}
