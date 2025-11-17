'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Settings,
  ArrowUp,
  ArrowDown,
  RefreshCw
} from 'lucide-react'
import { RoleMappingRule } from '@/lib/ssoRoleMapping'
import { toast } from '@/hooks/use-toast'

const ruleSchema = z.object({
  condition: z.object({
    attribute: z.string().min(1, '属性名不能为空'),
    operator: z.enum(['equals', 'contains', 'startsWith', 'endsWith', 'in', 'regex']),
    value: z.string().min(1, '条件值不能为空')
  }),
  targetRole: z.enum(['SYSTEM_ADMIN', 'DATA_ADMIN', 'BUSINESS_USER']),
  priority: z.number().min(0, '优先级不能小于0'),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
})

type RuleFormData = z.infer<typeof ruleSchema>

interface RoleMappingRulesProps {
  providerId: string
}

export default function RoleMappingRules({ providerId }: RoleMappingRulesProps) {
  const [rules, setRules] = useState<RoleMappingRule[]>([])
  const [loading, setLoading] = useState(false)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRule, setEditingRule] = useState<RoleMappingRule | null>(null)
  const [deleteRule, setDeleteRule] = useState<RoleMappingRule | null>(null)

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      condition: {
        attribute: '',
        operator: 'equals',
        value: ''
      },
      targetRole: 'BUSINESS_USER',
      priority: 0,
      description: '',
      isActive: true
    }
  })

  useEffect(() => {
    if (providerId) {
      fetchRules()
    }
  }, [providerId])

  const fetchRules = async () => {
    if (!providerId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/sso/role-mapping?providerId=${providerId}`)
      if (response.ok) {
        const data = await response.json()
        setRules(data.rules.sort((a: RoleMappingRule, b: RoleMappingRule) => a.priority - b.priority))
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRule = () => {
    setEditingRule(null)
    form.reset({
      condition: {
        attribute: '',
        operator: 'equals',
        value: ''
      },
      targetRole: 'BUSINESS_USER',
      priority: rules.length,
      description: '',
      isActive: true
    })
    setShowRuleForm(true)
  }

  const handleEditRule = (rule: RoleMappingRule) => {
    setEditingRule(rule)
    form.reset({
      condition: rule.condition,
      targetRole: rule.targetRole,
      priority: rule.priority,
      description: rule.description || '',
      isActive: rule.isActive
    })
    setShowRuleForm(true)
  }

  const onSubmit = async (data: RuleFormData) => {
    try {
      const ruleData = {
        providerId,
        ...data,
        // 如果是数组条件值，转换为数组
        condition: {
          ...data.condition,
          value: data.condition.operator === 'in' && typeof data.condition.value === 'string'
            ? data.condition.value.split(',').map(v => v.trim())
            : data.condition.value
        }
      }

      const url = editingRule
        ? `/api/admin/sso/role-mapping/${editingRule.id}`
        : '/api/admin/sso/role-mapping'
      const method = editingRule ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ruleData),
      })

      if (response.ok) {
        toast({
          title: editingRule ? '规则更新成功' : '规则创建成功',
          description: `角色映射规则已${editingRule ? '更新' : '创建'}`
        })
        setShowRuleForm(false)
        fetchRules()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error)
      }
    } catch (error) {
      toast({
        title: editingRule ? '更新失败' : '创建失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteRule = async () => {
    if (!deleteRule) return

    try {
      const response = await fetch(`/api/admin/sso/role-mapping/${deleteRule.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: '删除成功',
          description: '角色映射规则已删除'
        })
        fetchRules()
      } else {
        throw new Error('删除失败')
      }
    } catch (error) {
      toast({
        title: '删除失败',
        description: '无法删除角色映射规则',
        variant: 'destructive'
      })
    } finally {
      setDeleteRule(null)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SYSTEM_ADMIN':
        return <Badge className="bg-red-100 text-red-800">系统管理员</Badge>
      case 'DATA_ADMIN':
        return <Badge className="bg-blue-100 text-blue-800">数据管理员</Badge>
      case 'BUSINESS_USER':
        return <Badge className="bg-green-100 text-green-800">业务用户</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  const getOperatorLabel = (operator: string) => {
    const operatorMap = {
      equals: '等于',
      contains: '包含',
      startsWith: '开头是',
      endsWith: '结尾是',
      in: '在列表中',
      regex: '正则匹配'
    }
    return operatorMap[operator as keyof typeof operatorMap] || operator
  }

  if (!providerId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">请先选择SSO提供商</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>角色映射规则</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchRules} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              <Button onClick={handleCreateRule}>
                <Plus className="h-4 w-4 mr-2" />
                添加规则
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              加载中...
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">尚未配置角色映射规则</p>
              <Button className="mt-4" onClick={handleCreateRule}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一个规则
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>优先级</TableHead>
                    <TableHead>条件</TableHead>
                    <TableHead>目标角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{rule.priority}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="font-medium">{rule.condition.attribute}</span>
                            <span className="text-muted-foreground mx-2">
                              {getOperatorLabel(rule.condition.operator)}
                            </span>
                            <span className="font-mono text-sm bg-gray-100 px-1 rounded">
                              {Array.isArray(rule.condition.value)
                                ? rule.condition.value.join(', ')
                                : rule.condition.value}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(rule.targetRole)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? '活跃' : '禁用'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {rule.description || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRule(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteRule(rule)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 规则表单对话框 */}
      <Dialog open={showRuleForm} onOpenChange={setShowRuleForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? '编辑角色映射规则' : '创建角色映射规则'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="condition.attribute"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>属性名</FormLabel>
                      <FormControl>
                        <Input placeholder="例如: groups, department, email" {...field} />
                      </FormControl>
                      <FormDescription>
                        SSO用户属性名称，如groups、department、email等
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="condition.operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>操作符</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="equals">等于</SelectItem>
                          <SelectItem value="contains">包含</SelectItem>
                          <SelectItem value="startsWith">开头是</SelectItem>
                          <SelectItem value="endsWith">结尾是</SelectItem>
                          <SelectItem value="in">在列表中</SelectItem>
                          <SelectItem value="regex">正则匹配</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="condition.value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>条件值</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          form.watch('condition.operator') === 'in'
                            ? '多个值用逗号分隔，例如: admin,manager'
                            : '例如: admin'
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {form.watch('condition.operator') === 'in'
                        ? '多个值用逗号分隔'
                        : '匹配的属性值'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="targetRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>目标角色</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="BUSINESS_USER">业务用户</SelectItem>
                          <SelectItem value="DATA_ADMIN">数据管理员</SelectItem>
                          <SelectItem value="SYSTEM_ADMIN">系统管理员</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        匹配条件时分配的系统角色
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>优先级</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        数字越小优先级越高，0为最高优先级
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述（可选）</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="描述此规则的用途和条件"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用规则</FormLabel>
                      <FormDescription>
                        禁用的规则不会在角色映射中生效
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

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowRuleForm(false)}>
                  取消
                </Button>
                <Button type="submit">
                  {editingRule ? '更新规则' : '创建规则'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteRule} onOpenChange={() => setDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此角色映射规则吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}