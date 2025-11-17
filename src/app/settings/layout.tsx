import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '设置 - 数据资产管理平台',
  description: '管理您的账户设置和偏好配置',
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}