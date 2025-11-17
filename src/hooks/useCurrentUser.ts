import { useSession } from 'next-auth/react'
import { api } from '@/trpc/react'

export function useCurrentUser() {
  const { data: session, status } = useSession()

  // 这里可以进一步从tRPC获取更详细的用户信息
  const { data: userProfile, isLoading: isLoadingProfile } = api.users.getProfile.useQuery(
    undefined, // 不需要参数，tRPC会从session中获取用户ID
    {
      enabled: !!session?.user?.id, // 只有在有session时才查询
    }
  )

  const isLoading = status === 'loading' || isLoadingProfile

  // 合并session和profile数据
  const user = session?.user ? {
    id: session.user.id,
    name: userProfile?.name || session.user.name || '',
    email: userProfile?.email || session.user.email || '',
    department: userProfile?.department || '',
    role: userProfile?.role || 'BUSINESS_USER',
    username: userProfile?.username || '',
  } : null

  return {
    user,
    isLoading,
    isAuthenticated: !!session?.user,
    session,
  }
}