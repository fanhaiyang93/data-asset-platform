import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '管理后台 - 数据资产管理平台',
  description: '数据资产管理平台管理后台,提供资产管理、用户管理、申请审核等功能'
}

export default function AdminLayoutRoot({
  children,
}: {
  children: React.ReactNode
}) {
  // admin页面现在使用与主页面相同的布局(DashboardLayout)
  // 由父级 (dashboard) layout 提供统一的布局和导航
  return <>{children}</>
}
