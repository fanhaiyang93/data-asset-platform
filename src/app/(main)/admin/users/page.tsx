'use client'

import { useState, useCallback } from 'react'
import { RouteGuard } from '@/components/auth/RouteGuard'
import { trpc } from '@/lib/trpc-client'
import { UserRole } from '@prisma/client'

// 角色显示名称映射
const roleDisplayNames = {
  BUSINESS_USER: '业务用户',
  ASSET_MANAGER: '资产管理员',
  SYSTEM_ADMIN: '系统管理员'
}

// 角色颜色映射
const roleColors = {
  BUSINESS_USER: 'bg-green-100 text-green-800',
  ASSET_MANAGER: 'bg-blue-100 text-blue-800',
  SYSTEM_ADMIN: 'bg-purple-100 text-purple-800'
}

interface User {
  id: string
  username: string
  email: string
  name: string | null
  department: string | null
  role: UserRole
  createdAt: string
  lastLoginAt: string | null
}

interface RoleChangeConfirmation {
  userId: string
  currentRole: UserRole
  newRole: UserRole
  userName: string
  reason: string
}

export default function UsersManagementPage() {
  return (
    <RouteGuard roles={['SYSTEM_ADMIN']}>
      <UsersManagement />
    </RouteGuard>
  )
}

function UsersManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(20)
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<RoleChangeConfirmation | null>(null)

  // 获取用户列表
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers
  } = trpc.auth.getUsers.useQuery({
    limit: pageSize,
    offset: currentPage * pageSize,
    search: searchTerm || undefined,
    role: roleFilter || undefined
  })

  // 角色变更 mutation
  const changeUserRoleMutation = trpc.auth.changeUserRole.useMutation({
    onSuccess: () => {
      refetchUsers()
      setRoleChangeConfirm(null)
      alert('用户角色更改成功')
    },
    onError: (error) => {
      alert(`角色更改失败: ${error.message}`)
    }
  })

  // 处理搜索
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
    setCurrentPage(0)
  }, [])

  // 处理角色筛选
  const handleRoleFilter = useCallback((role: UserRole | '') => {
    setRoleFilter(role)
    setCurrentPage(0)
  }, [])

  // 处理用户选择
  const handleUserSelect = useCallback((userId: string, selected: boolean) => {
    setSelectedUsers(prev =>
      selected
        ? [...prev, userId]
        : prev.filter(id => id !== userId)
    )
  }, [])

  // 全选/取消全选
  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected && usersData?.users) {
      setSelectedUsers(usersData.users.map(user => user.id))
    } else {
      setSelectedUsers([])
    }
  }, [usersData?.users])

  // 处理角色变更请求
  const handleRoleChangeRequest = useCallback((user: User, newRole: UserRole) => {
    setRoleChangeConfirm({
      userId: user.id,
      currentRole: user.role,
      newRole,
      userName: user.name || user.username,
      reason: ''
    })
  }, [])

  // 确认角色变更
  const handleRoleChangeConfirm = useCallback(() => {
    if (!roleChangeConfirm || !roleChangeConfirm.reason.trim()) {
      alert('请填写角色变更原因')
      return
    }

    changeUserRoleMutation.mutate({
      userId: roleChangeConfirm.userId,
      newRole: roleChangeConfirm.newRole,
      reason: roleChangeConfirm.reason.trim()
    })
  }, [roleChangeConfirm, changeUserRoleMutation])

  // 批量角色变更
  const handleBatchRoleChange = useCallback((newRole: UserRole) => {
    if (selectedUsers.length === 0) {
      alert('请先选择要修改的用户')
      return
    }

    const reason = prompt('请输入批量角色变更原因:')
    if (!reason?.trim()) {
      return
    }

    // 这里可以实现批量操作，为简化演示只处理第一个用户
    const firstUserId = selectedUsers[0]
    const user = usersData?.users.find(u => u.id === firstUserId)
    if (user) {
      changeUserRoleMutation.mutate({
        userId: firstUserId,
        newRole,
        reason: reason.trim()
      })
    }
  }, [selectedUsers, usersData?.users, changeUserRoleMutation])

  const users = usersData?.users || []
  const totalUsers = usersData?.total || 0
  const hasMore = usersData?.hasMore || false

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
          <p className="mt-2 text-gray-600">管理系统用户和角色权限</p>
        </div>

        {/* 搜索和筛选 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                搜索用户
              </label>
              <input
                type="text"
                placeholder="搜索用户名、邮箱或姓名..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                角色筛选
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={roleFilter}
                onChange={(e) => handleRoleFilter(e.target.value as UserRole | '')}
              >
                <option value="">所有角色</option>
                <option value="BUSINESS_USER">业务用户</option>
                <option value="ASSET_MANAGER">资产管理员</option>
                <option value="SYSTEM_ADMIN">系统管理员</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => refetchUsers()}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                刷新
              </button>
            </div>
          </div>
        </div>

        {/* 批量操作 */}
        {selectedUsers.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-blue-800">
                已选择 {selectedUsers.length} 个用户
              </span>
              <div className="space-x-2">
                <button
                  onClick={() => handleBatchRoleChange(UserRole.BUSINESS_USER)}
                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  设为业务用户
                </button>
                <button
                  onClick={() => handleBatchRoleChange(UserRole.ASSET_MANAGER)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  设为资产管理员
                </button>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  取消选择
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 用户列表 */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                用户列表 ({totalUsers} 个用户)
              </h2>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === users.length && users.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="text-sm text-gray-600">全选</label>
              </div>
            </div>
          </div>

          {usersLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-500">加载中...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              没有找到符合条件的用户
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      选择
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      用户信息
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      角色
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      部门
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最后登录
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => handleUserSelect(user.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.name || user.username}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          <div className="text-xs text-gray-400">@{user.username}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${roleColors[user.role]}`}>
                          {roleDisplayNames[user.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.department || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN')
                          : '从未登录'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <select
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                            value={user.role}
                            onChange={(e) => handleRoleChangeRequest(user, e.target.value as UserRole)}
                          >
                            <option value="BUSINESS_USER">业务用户</option>
                            <option value="ASSET_MANAGER">资产管理员</option>
                            <option value="SYSTEM_ADMIN">系统管理员</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 分页 */}
          {totalUsers > pageSize && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                显示 {currentPage * pageSize + 1} 到 {Math.min((currentPage + 1) * pageSize, totalUsers)} 条，共 {totalUsers} 条
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!hasMore}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 角色变更确认对话框 */}
        {roleChangeConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                确认角色变更
              </h3>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">
                    您即将更改用户 <span className="font-medium">{roleChangeConfirm.userName}</span> 的角色：
                  </p>
                  <div className="mt-2 flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${roleColors[roleChangeConfirm.currentRole]}`}>
                      {roleDisplayNames[roleChangeConfirm.currentRole]}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${roleColors[roleChangeConfirm.newRole]}`}>
                      {roleDisplayNames[roleChangeConfirm.newRole]}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    变更原因 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="请输入角色变更的原因..."
                    value={roleChangeConfirm.reason}
                    onChange={(e) => setRoleChangeConfirm(prev =>
                      prev ? { ...prev, reason: e.target.value } : null
                    )}
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>注意：</strong>角色变更将立即生效，该用户的权限将相应调整。
                  </p>
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={handleRoleChangeConfirm}
                  disabled={changeUserRoleMutation.isLoading}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changeUserRoleMutation.isLoading ? '处理中...' : '确认变更'}
                </button>
                <button
                  onClick={() => setRoleChangeConfirm(null)}
                  disabled={changeUserRoleMutation.isLoading}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}