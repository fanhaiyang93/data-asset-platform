'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Settings, Activity, BarChart3, FileText } from 'lucide-react'
import SSOProviderList from '@/components/admin/sso/SSOProviderList'
import SSOProviderForm from '@/components/admin/sso/SSOProviderForm'
import SSOStatistics from '@/components/admin/sso/SSOStatistics'
import SSOLogs from '@/components/admin/sso/SSOLogs'
import { SSOProvider } from '@/types/sso'

type TabType = 'providers' | 'statistics' | 'logs' | 'settings'

export default function SSOManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('providers')
  const [showProviderForm, setShowProviderForm] = useState(false)
  const [editingProvider, setEditingProvider] = useState<SSOProvider | null>(null)
  const [providers, setProviders] = useState<SSOProvider[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProviders()
  }, [])

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/sso/providers')
      if (response.ok) {
        const data = await response.json()
        setProviders(data.providers)
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProvider = () => {
    setEditingProvider(null)
    setShowProviderForm(true)
  }

  const handleEditProvider = (provider: SSOProvider) => {
    setEditingProvider(provider)
    setShowProviderForm(true)
  }

  const handleProviderSaved = () => {
    setShowProviderForm(false)
    setEditingProvider(null)
    fetchProviders()
  }

  const tabs = [
    {
      id: 'providers' as const,
      label: 'SSO提供商',
      icon: Settings,
      component: (
        <SSOProviderList
          providers={providers}
          loading={loading}
          onEdit={handleEditProvider}
          onRefresh={fetchProviders}
        />
      )
    },
    {
      id: 'statistics' as const,
      label: '统计信息',
      icon: BarChart3,
      component: <SSOStatistics providers={providers} />
    },
    {
      id: 'logs' as const,
      label: '认证日志',
      icon: Activity,
      component: <SSOLogs />
    },
    {
      id: 'settings' as const,
      label: '系统设置',
      icon: FileText,
      component: (
        <Card>
          <CardHeader>
            <CardTitle>系统设置</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">SSO系统配置选项将在此处提供。</p>
          </CardContent>
        </Card>
      )
    }
  ]

  const activeTabData = tabs.find(tab => tab.id === activeTab)

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">SSO 管理</h1>
          <p className="text-muted-foreground">管理单点登录配置和监控认证活动</p>
        </div>
        {activeTab === 'providers' && (
          <Button onClick={handleCreateProvider}>
            <Plus className="mr-2 h-4 w-4" />
            创建SSO提供商
          </Button>
        )}
      </div>

      {/* 统计概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">总提供商</p>
                <p className="text-2xl font-bold">{providers.length}</p>
              </div>
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">活跃提供商</p>
                <p className="text-2xl font-bold text-green-600">
                  {providers.filter(p => p.status === 'ACTIVE').length}
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">健康状态</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">
                    {providers.filter(p => p.healthStatus === 'healthy').length}
                  </p>
                  <Badge variant="outline" className="text-green-600">
                    健康
                  </Badge>
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">今日登录</p>
                <p className="text-2xl font-bold">-</p>
              </div>
              <FileText className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 选项卡导航 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-2 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="mr-2 h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* 选项卡内容 */}
      <div className="tab-content">
        {activeTabData?.component}
      </div>

      {/* SSO提供商表单模态框 */}
      {showProviderForm && (
        <SSOProviderForm
          provider={editingProvider}
          isOpen={showProviderForm}
          onClose={() => setShowProviderForm(false)}
          onSave={handleProviderSaved}
        />
      )}
    </div>
  )
}