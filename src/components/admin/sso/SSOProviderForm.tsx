'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Plus } from 'lucide-react'
import { SSOProvider, SSOProviderConfig, SSOProviderType, SSOProviderStatus } from '@/types/sso'
import { toast } from '@/hooks/use-toast'

const formSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  type: z.enum(['SAML', 'OAUTH', 'LDAP', 'OIDC']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TESTING', 'MAINTENANCE']),

  // 基础配置
  entityId: z.string().optional(),
  ssoUrl: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  sloUrl: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  certificateData: z.string().optional(),
  privateKeyData: z.string().optional(),

  // OAuth专用
  clientSecret: z.string().optional(),
  userInfoUrl: z.string().url('请输入有效的URL').optional().or(z.literal('')),

  // LDAP专用
  ldapUrl: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  baseDn: z.string().optional(),
  bindDn: z.string().optional(),
  bindPassword: z.string().optional(),
  userFilter: z.string().optional(),

  // 高级配置
  autoProvision: z.boolean().default(true),
  updateAttributes: z.boolean().default(true),
  enforceSSO: z.boolean().default(false),
})

type FormData = z.infer<typeof formSchema>

interface SSOProviderFormProps {
  provider?: SSOProvider | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export default function SSOProviderForm({
  provider,
  isOpen,
  onClose,
  onSave
}: SSOProviderFormProps) {
  const [loading, setLoading] = useState(false)
  const [scopes, setScopes] = useState<string[]>([])
  const [newScope, setNewScope] = useState('')
  const [attributeMapping, setAttributeMapping] = useState<Record<string, string>>({})
  const [roleMapping, setRoleMapping] = useState<Record<string, string>>({})

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'SAML',
      status: 'INACTIVE',
      autoProvision: true,
      updateAttributes: true,
      enforceSSO: false,
    },
  })

  const watchedType = form.watch('type')

  useEffect(() => {
    if (provider) {
      form.reset({
        name: provider.name,
        type: provider.type,
        status: provider.status,
        entityId: provider.entityId || '',
        ssoUrl: provider.ssoUrl || '',
        sloUrl: provider.sloUrl || '',
        certificateData: typeof provider.certificateData === 'string' && provider.certificateData !== '[已配置]' ? provider.certificateData : '',
        privateKeyData: typeof provider.privateKeyData === 'string' && provider.privateKeyData !== '[已配置]' ? provider.privateKeyData : '',
        clientSecret: typeof provider.clientSecret === 'string' && provider.clientSecret !== '[已配置]' ? provider.clientSecret : '',
        userInfoUrl: provider.userInfoUrl || '',
        ldapUrl: provider.ldapUrl || '',
        baseDn: provider.baseDn || '',
        bindDn: provider.bindDn || '',
        bindPassword: typeof provider.bindPassword === 'string' && provider.bindPassword !== '[已配置]' ? provider.bindPassword : '',
        userFilter: provider.userFilter || '',
        autoProvision: provider.autoProvision ?? true,
        updateAttributes: provider.updateAttributes ?? true,
        enforceSSO: provider.enforceSSO ?? false,
      })

      setScopes(provider.scopes || [])
      setAttributeMapping(provider.attributeMapping || {})
      setRoleMapping(provider.roleMapping || {})
    } else {
      form.reset({
        name: '',
        type: 'SAML',
        status: 'INACTIVE',
        autoProvision: true,
        updateAttributes: true,
        enforceSSO: false,
      })
      setScopes([])
      setAttributeMapping({})
      setRoleMapping({})
    }
  }, [provider, form])

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const config: SSOProviderConfig = {
        ...data,
        scopes: scopes.length > 0 ? scopes : undefined,
        attributeMapping: Object.keys(attributeMapping).length > 0 ? attributeMapping : undefined,
        roleMapping: Object.keys(roleMapping).length > 0 ? roleMapping : undefined,
      }

      // 清理空字符串
      Object.keys(config).forEach(key => {
        if (config[key as keyof SSOProviderConfig] === '') {
          delete config[key as keyof SSOProviderConfig]
        }
      })

      const url = provider
        ? `/api/admin/sso/providers/${provider.id}`
        : '/api/admin/sso/providers'
      const method = provider ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (response.ok) {
        toast({
          title: provider ? '更新成功' : '创建成功',
          description: `SSO提供商 "${data.name}" 已${provider ? '更新' : '创建'}`
        })
        onSave()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error)
      }
    } catch (error) {
      toast({
        title: provider ? '更新失败' : '创建失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const addScope = () => {
    if (newScope.trim() && !scopes.includes(newScope.trim())) {
      setScopes([...scopes, newScope.trim()])
      setNewScope('')
    }
  }

  const removeScope = (scope: string) => {
    setScopes(scopes.filter(s => s !== scope))
  }

  const addAttributeMapping = () => {
    const key = `attribute_${Object.keys(attributeMapping).length + 1}`
    setAttributeMapping({ ...attributeMapping, [key]: '' })
  }

  const updateAttributeMapping = (oldKey: string, newKey: string, value: string) => {
    const newMapping = { ...attributeMapping }
    if (oldKey !== newKey) {
      delete newMapping[oldKey]
    }
    newMapping[newKey] = value
    setAttributeMapping(newMapping)
  }

  const removeAttributeMapping = (key: string) => {
    const newMapping = { ...attributeMapping }
    delete newMapping[key]
    setAttributeMapping(newMapping)
  }

  const addRoleMapping = () => {
    const key = `role_${Object.keys(roleMapping).length + 1}`
    setRoleMapping({ ...roleMapping, [key]: '' })
  }

  const updateRoleMapping = (oldKey: string, newKey: string, value: string) => {
    const newMapping = { ...roleMapping }
    if (oldKey !== newKey) {
      delete newMapping[oldKey]
    }
    newMapping[newKey] = value
    setRoleMapping(newMapping)
  }

  const removeRoleMapping = (key: string) => {
    const newMapping = { ...roleMapping }
    delete newMapping[key]
    setRoleMapping(newMapping)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {provider ? '编辑SSO提供商' : '创建SSO提供商'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input placeholder="SSO提供商名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>类型</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择SSO类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SAML">SAML 2.0</SelectItem>
                        <SelectItem value="OAUTH">OAuth 2.0</SelectItem>
                        <SelectItem value="LDAP">LDAP</SelectItem>
                        <SelectItem value="OIDC">OpenID Connect</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>状态</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVE">活跃</SelectItem>
                      <SelectItem value="INACTIVE">非活跃</SelectItem>
                      <SelectItem value="TESTING">测试中</SelectItem>
                      <SelectItem value="MAINTENANCE">维护中</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">基础配置</TabsTrigger>
                <TabsTrigger value="advanced">高级配置</TabsTrigger>
                <TabsTrigger value="mapping">属性映射</TabsTrigger>
                <TabsTrigger value="security">安全配置</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                {/* SAML配置 */}
                {watchedType === 'SAML' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>SAML 配置</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="entityId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Entity ID</FormLabel>
                            <FormControl>
                              <Input placeholder="https://your-domain.com/saml/metadata" {...field} />
                            </FormControl>
                            <FormDescription>SAML实体标识符</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="ssoUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SSO URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://your-idp.com/saml/sso" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="sloUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SLO URL (可选)</FormLabel>
                              <FormControl>
                                <Input placeholder="https://your-idp.com/saml/slo" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="certificateData"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>X.509 证书</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
                                className="h-32"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>用于验证SAML断言的证书</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* OAuth配置 */}
                {watchedType === 'OAUTH' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>OAuth 2.0 配置</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="entityId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client ID</FormLabel>
                              <FormControl>
                                <Input placeholder="your-oauth-client-id" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="clientSecret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client Secret</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="your-oauth-client-secret"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="ssoUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>授权URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://oauth-provider.com/authorize" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="userInfoUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>用户信息URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://oauth-provider.com/userinfo" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div>
                        <FormLabel>OAuth Scopes</FormLabel>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {scopes.map((scope) => (
                            <Badge key={scope} variant="secondary" className="cursor-pointer">
                              {scope}
                              <X
                                className="ml-1 h-3 w-3"
                                onClick={() => removeScope(scope)}
                              />
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="添加scope (如: openid, profile, email)"
                            value={newScope}
                            onChange={(e) => setNewScope(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addScope())}
                          />
                          <Button type="button" variant="outline" onClick={addScope}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* LDAP配置 */}
                {watchedType === 'LDAP' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>LDAP 配置</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="ldapUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>LDAP服务器URL</FormLabel>
                            <FormControl>
                              <Input placeholder="ldap://ldap.company.com:389" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="baseDn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Base DN</FormLabel>
                              <FormControl>
                                <Input placeholder="dc=company,dc=com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="bindDn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bind DN (可选)</FormLabel>
                              <FormControl>
                                <Input placeholder="cn=admin,dc=company,dc=com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="bindPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bind密码 (可选)</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="userFilter"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>用户过滤器</FormLabel>
                              <FormControl>
                                <Input placeholder="(uid={username})" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>高级设置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="autoProvision"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">自动创建用户</FormLabel>
                            <FormDescription>
                              首次SSO登录时自动创建用户账户
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="updateAttributes"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">更新用户属性</FormLabel>
                            <FormDescription>
                              每次SSO登录时更新用户信息
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enforceSSO"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">强制SSO登录</FormLabel>
                            <FormDescription>
                              禁用传统用户名密码登录
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  {/* 属性映射 */}
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>属性映射</CardTitle>
                        <Button type="button" variant="outline" size="sm" onClick={addAttributeMapping}>
                          <Plus className="h-4 w-4 mr-1" />
                          添加
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {Object.entries(attributeMapping).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <Input
                            placeholder="SSO属性名"
                            value={key}
                            onChange={(e) => updateAttributeMapping(key, e.target.value, value)}
                          />
                          <Input
                            placeholder="系统字段名"
                            value={value}
                            onChange={(e) => updateAttributeMapping(key, key, e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttributeMapping(key)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {Object.keys(attributeMapping).length === 0 && (
                        <p className="text-sm text-muted-foreground">暂无属性映射</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* 角色映射 */}
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>角色映射</CardTitle>
                        <Button type="button" variant="outline" size="sm" onClick={addRoleMapping}>
                          <Plus className="h-4 w-4 mr-1" />
                          添加
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {Object.entries(roleMapping).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <Input
                            placeholder="SSO角色"
                            value={key}
                            onChange={(e) => updateRoleMapping(key, e.target.value, value)}
                          />
                          <Input
                            placeholder="系统角色"
                            value={value}
                            onChange={(e) => updateRoleMapping(key, key, e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRoleMapping(key)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {Object.keys(roleMapping).length === 0 && (
                        <p className="text-sm text-muted-foreground">暂无角色映射</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                {watchedType === 'SAML' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>SAML 安全配置</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="privateKeyData"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>私钥 (可选)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
                                className="h-32"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>用于签名SAML请求的私钥</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}