'use client';

import React, { useState, useCallback } from 'react';
import { AssetCategory } from '@/types/assetOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Edit,
  Trash2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Move
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CategoryManagerProps {
  selectedCategoryId?: string;
  onCategorySelect: (category: AssetCategory) => void;
  allowCreate?: boolean;
  allowEdit?: boolean;
  showCounts?: boolean;
}

// 模拟分类数据
const MOCK_CATEGORIES: AssetCategory[] = [
  {
    id: 'user_data',
    name: '用户数据',
    code: 'USER_DATA',
    description: '用户相关的所有数据，包括基本信息、行为数据等',
    level: 0,
    path: '/用户数据',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    children: [
      {
        id: 'user_profile',
        name: '用户档案',
        code: 'USER_PROFILE',
        description: '用户基本信息和档案数据',
        parentId: 'user_data',
        level: 1,
        path: '/用户数据/用户档案',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'user_behavior',
        name: '用户行为',
        code: 'USER_BEHAVIOR',
        description: '用户在平台上的行为数据',
        parentId: 'user_data',
        level: 1,
        path: '/用户数据/用户行为',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      }
    ]
  },
  {
    id: 'business_data',
    name: '业务数据',
    code: 'BUSINESS_DATA',
    description: '核心业务流程相关数据',
    level: 0,
    path: '/业务数据',
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16'),
    children: [
      {
        id: 'orders',
        name: '订单数据',
        code: 'ORDERS',
        description: '订单相关的所有数据',
        parentId: 'business_data',
        level: 1,
        path: '/业务数据/订单数据',
        createdAt: new Date('2024-01-16'),
        updatedAt: new Date('2024-01-16')
      },
      {
        id: 'products',
        name: '产品数据',
        code: 'PRODUCTS',
        description: '产品目录和相关信息',
        parentId: 'business_data',
        level: 1,
        path: '/业务数据/产品数据',
        createdAt: new Date('2024-01-16'),
        updatedAt: new Date('2024-01-16')
      },
      {
        id: 'payments',
        name: '支付数据',
        code: 'PAYMENTS',
        description: '支付交易相关数据',
        parentId: 'business_data',
        level: 1,
        path: '/业务数据/支付数据',
        createdAt: new Date('2024-01-16'),
        updatedAt: new Date('2024-01-16')
      }
    ]
  },
  {
    id: 'system_data',
    name: '系统数据',
    code: 'SYSTEM_DATA',
    description: '系统运行和监控相关数据',
    level: 0,
    path: '/系统数据',
    createdAt: new Date('2024-01-17'),
    updatedAt: new Date('2024-01-17'),
    children: [
      {
        id: 'logs',
        name: '日志数据',
        code: 'LOGS',
        description: '应用和系统日志',
        parentId: 'system_data',
        level: 1,
        path: '/系统数据/日志数据',
        createdAt: new Date('2024-01-17'),
        updatedAt: new Date('2024-01-17')
      },
      {
        id: 'metrics',
        name: '监控指标',
        code: 'METRICS',
        description: '系统性能和业务指标',
        parentId: 'system_data',
        level: 1,
        path: '/系统数据/监控指标',
        createdAt: new Date('2024-01-17'),
        updatedAt: new Date('2024-01-17')
      }
    ]
  },
  {
    id: 'external_data',
    name: '外部数据',
    code: 'EXTERNAL_DATA',
    description: '第三方或外部接口数据',
    level: 0,
    path: '/外部数据',
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-18')
  }
];

// 模拟分类统计数据
const CATEGORY_COUNTS: Record<string, number> = {
  'user_data': 45,
  'user_profile': 18,
  'user_behavior': 27,
  'business_data': 78,
  'orders': 23,
  'products': 31,
  'payments': 24,
  'system_data': 34,
  'logs': 19,
  'metrics': 15,
  'external_data': 12
};

export default function CategoryManager({
  selectedCategoryId,
  onCategorySelect,
  allowCreate = true,
  allowEdit = true,
  showCounts = true
}: CategoryManagerProps) {
  const [categories, setCategories] = useState<AssetCategory[]>(MOCK_CATEGORIES);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['user_data', 'business_data']));
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    code: '',
    description: '',
    parentId: ''
  });

  // 切换展开/折叠
  const toggleExpanded = useCallback((categoryId: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  // 获取平铺的分类列表（用于搜索）
  const getFlatCategories = useCallback((categories: AssetCategory[]): AssetCategory[] => {
    const flat: AssetCategory[] = [];

    const traverse = (cats: AssetCategory[]) => {
      cats.forEach(cat => {
        flat.push(cat);
        if (cat.children) {
          traverse(cat.children);
        }
      });
    };

    traverse(categories);
    return flat;
  }, []);

  // 过滤分类
  const getFilteredCategories = useCallback(() => {
    if (!searchTerm.trim()) return categories;

    const flatCategories = getFlatCategories(categories);
    const matchedIds = new Set<string>();

    // 找到匹配的分类
    flatCategories.forEach(cat => {
      if (cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cat.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
        matchedIds.add(cat.id);

        // 同时包含父级分类
        let parentId = cat.parentId;
        while (parentId) {
          matchedIds.add(parentId);
          const parent = flatCategories.find(c => c.id === parentId);
          parentId = parent?.parentId;
        }
      }
    });

    // 过滤并重建分类树
    const filterTree = (cats: AssetCategory[]): AssetCategory[] => {
      return cats.filter(cat => matchedIds.has(cat.id)).map(cat => ({
        ...cat,
        children: cat.children ? filterTree(cat.children) : undefined
      }));
    };

    return filterTree(categories);
  }, [categories, searchTerm, getFlatCategories]);

  // 创建新分类
  const handleCreateCategory = useCallback(async () => {
    try {
      // 验证输入
      if (!newCategory.name.trim()) {
        alert('请输入分类名称');
        return;
      }

      // 生成代码
      const code = newCategory.code || newCategory.name.toUpperCase().replace(/\s+/g, '_');

      const category: AssetCategory = {
        id: `cat_${Date.now()}`,
        name: newCategory.name.trim(),
        code,
        description: newCategory.description.trim(),
        parentId: newCategory.parentId || undefined,
        level: newCategory.parentId ? 1 : 0,
        path: newCategory.parentId
          ? `/${categories.find(c => c.id === newCategory.parentId)?.name}/${newCategory.name}`
          : `/${newCategory.name}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 500));

      // 更新分类列表
      setCategories(prev => {
        if (newCategory.parentId) {
          // 添加到父分类下
          return prev.map(cat => {
            if (cat.id === newCategory.parentId) {
              return {
                ...cat,
                children: [...(cat.children || []), category]
              };
            }
            return cat;
          });
        } else {
          // 添加为顶级分类
          return [...prev, category];
        }
      });

      // 重置表单
      setNewCategory({ name: '', code: '', description: '', parentId: '' });
      setIsCreateDialogOpen(false);

      alert('分类创建成功');
    } catch (error) {
      console.error('创建分类失败:', error);
      alert('创建分类失败');
    }
  }, [newCategory, categories]);

  // 删除分类
  const handleDeleteCategory = useCallback(async (categoryId: string) => {
    if (!window.confirm('确定要删除此分类吗？删除后不可恢复。')) {
      return;
    }

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 300));

      // 从分类列表中移除
      setCategories(prev => {
        const removeFromTree = (cats: AssetCategory[]): AssetCategory[] => {
          return cats.filter(cat => cat.id !== categoryId).map(cat => ({
            ...cat,
            children: cat.children ? removeFromTree(cat.children) : undefined
          }));
        };
        return removeFromTree(prev);
      });

      alert('分类删除成功');
    } catch (error) {
      console.error('删除分类失败:', error);
      alert('删除分类失败');
    }
  }, []);

  // 渲染分类项
  const renderCategoryItem = useCallback((category: AssetCategory, depth: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedIds.has(category.id);
    const isSelected = selectedCategoryId === category.id;
    const count = showCounts ? CATEGORY_COUNTS[category.id] || 0 : 0;

    return (
      <div key={category.id} className="select-none">
        <div
          className={`group flex items-center space-x-2 p-2 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-50 border border-blue-200'
              : 'hover:bg-gray-50'
          }`}
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
          onClick={() => onCategorySelect(category)}
        >
          {/* 展开/折叠按钮 */}
          <div className="w-6 h-6 flex items-center justify-center">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(category.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            ) : (
              <div className="w-4 h-4" />
            )}
          </div>

          {/* 分类图标 */}
          <div className="flex-shrink-0">
            {hasChildren ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-blue-600" />
              ) : (
                <Folder className="w-4 h-4 text-blue-600" />
              )
            ) : (
              <Folder className="w-4 h-4 text-gray-500" />
            )}
          </div>

          {/* 分类信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                {category.name}
              </span>
              {showCounts && count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {count}
                </Badge>
              )}
            </div>
            {category.description && (
              <p className="text-xs text-gray-500 truncate">{category.description}</p>
            )}
          </div>

          {/* 操作按钮 */}
          {allowEdit && (
            <div className="flex items-center space-x-1 transition-opacity duration-200 opacity-0 group-hover:opacity-100" style={{ pointerEvents: 'auto' }}>
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('编辑按钮被点击');
                  setEditingCategory(category);
                }}
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0 text-red-600 hover:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('删除按钮被点击, category.id:', category.id);
                  handleDeleteCategory(category.id);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* 子分类 */}
        {hasChildren && isExpanded && category.children && (
          <div>
            {category.children.map(child => renderCategoryItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedIds, selectedCategoryId, showCounts, allowEdit, onCategorySelect, toggleExpanded, handleDeleteCategory]);

  const filteredCategories = getFilteredCategories();

  return (
    <div className="space-y-4">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">资产分类</h3>
        {allowCreate && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                新建分类
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新分类</DialogTitle>
                <DialogDescription>
                  为数据资产创建新的分类，便于管理和查找
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>分类名称 *</Label>
                    <Input
                      value={newCategory.name}
                      onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="输入分类名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>分类代码</Label>
                    <Input
                      value={newCategory.code}
                      onChange={(e) => setNewCategory(prev => ({ ...prev, code: e.target.value }))}
                      placeholder="自动生成或手动输入"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>父分类</Label>
                  <Select
                    value={newCategory.parentId}
                    onValueChange={(value) => setNewCategory(prev => ({ ...prev, parentId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择父分类（可选）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">无（顶级分类）</SelectItem>
                      {getFlatCategories(categories).filter(cat => cat.level === 0).map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>描述</Label>
                  <Textarea
                    value={newCategory.description}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="输入分类描述"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateCategory}>
                  <Save className="w-4 h-4 mr-1" />
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="搜索分类名称或描述..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* 分类树 */}
      <Card>
        <CardContent className="p-4">
          {filteredCategories.length > 0 ? (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredCategories.map(category => renderCategoryItem(category))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Folder className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? '未找到匹配的分类' : '暂无分类'}
              </h4>
              <p className="text-gray-600 mb-4">
                {searchTerm
                  ? '尝试使用其他关键词搜索'
                  : '开始创建第一个资产分类'
                }
              </p>
              {allowCreate && !searchTerm && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建分类
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分类统计 */}
      {showCounts && filteredCategories.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">📊 分类统计</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-blue-700">
              <div>
                <span className="font-medium">总分类：</span>
                <span>{getFlatCategories(categories).length}</span>
              </div>
              <div>
                <span className="font-medium">顶级分类：</span>
                <span>{categories.length}</span>
              </div>
              <div>
                <span className="font-medium">总资产：</span>
                <span>{Object.values(CATEGORY_COUNTS).reduce((sum, count) => sum + count, 0)}</span>
              </div>
              <div>
                <span className="font-medium">平均每类：</span>
                <span>{Math.round(Object.values(CATEGORY_COUNTS).reduce((sum, count) => sum + count, 0) / getFlatCategories(categories).length)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}