import { cookies } from 'next/headers'
import * as jose from 'jose'

export interface SessionUser {
  id: string
  email: string
  username: string
  name?: string | null
  role: string
}

export interface Session {
  user: SessionUser
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) {
    return null
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key')
    const { payload } = await jose.jwtVerify(token, secret)

    return {
      user: {
        id: payload.userId as string,
        email: payload.email as string,
        username: payload.username as string,
        name: payload.name as string | null,
        role: payload.role as string,
      },
    }
  } catch (error) {
    console.error('Session verification failed:', error)
    return null
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession()
  if (session.user.role !== 'SYSTEM_ADMIN' && session.user.role !== 'ASSET_MANAGER') {
    throw new Error('Forbidden: Admin access required')
  }
  return session
}
