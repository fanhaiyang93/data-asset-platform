'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/hooks/useAuth'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth()

  return (
    <DashboardLayout
      user={
        user
          ? {
              name: user.name || user.username,
              email: user.email || '',
              role: user.role || 'BUSINESS_USER',
            }
          : undefined
      }
      notificationCount={0}
      onLogout={logout}
    >
      {children}
    </DashboardLayout>
  )
}
