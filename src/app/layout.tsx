import './globals.css'
import type { Metadata } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider, App } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { Inter } from 'next/font/google'
import antdTheme, { cssVariables } from '@/theme'
import { TRPCProvider } from '@/components/providers/TRPCProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '数据资产管理平台',
  description: '企业数据资产管理和申请平台',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={inter.className}
        style={cssVariables}
      >
        <TRPCProvider>
          <AntdRegistry>
            <ConfigProvider
              theme={antdTheme}
              locale={zhCN}
              componentSize="middle"
            >
              <App>
                {children}
              </App>
            </ConfigProvider>
          </AntdRegistry>
        </TRPCProvider>
      </body>
    </html>
  )
}