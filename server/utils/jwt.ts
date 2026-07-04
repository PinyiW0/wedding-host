import { jwtVerify, SignJWT } from 'jose'

// JWT payload：身分三要素，其餘資訊由 server 端以 userId 回查
export interface AuthTokenPayload {
  userId: string
  role: string
  weddingId: string | null
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(useRuntimeConfig().jwtSecret)
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return await new SignJWT({ role: payload.role, weddingId: payload.weddingId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(useRuntimeConfig().jwtExpiresIn)
    .sign(secretKey())
}

// 驗證失敗（簽章不符／過期／格式錯誤）回 null，由呼叫端決定 401 或 fallback
export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (!payload.sub)
      return null
    return {
      userId: payload.sub,
      role: typeof payload.role === 'string' ? payload.role : '',
      weddingId: typeof payload.weddingId === 'string' ? payload.weddingId : null,
    }
  }
  catch {
    return null
  }
}
