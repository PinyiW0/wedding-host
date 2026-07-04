import { Buffer } from 'node:buffer'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// 密碼雜湊：Node 內建 scrypt（免外部依賴），格式 scrypt$<salt hex>$<hash hex>
export function hashPassword(plain: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(plain, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

// 驗證失敗（含空字串／格式不符，如註冊後尚未設密碼的帳號）一律回 false
export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex)
    return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(plain, Buffer.from(saltHex, 'hex'), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
