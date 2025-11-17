import { PrismaClient, UserRole, AssetStatus, AssetSensitivity } from '@prisma/client'
import { AuthService } from '../src/lib/auth'

const prisma = new PrismaClient()

async function main() {
  console.log('开始权限系统数据seeding...')

  // 1. 创建基础权限配置
  console.log('创建基础权限配置...')

  const permissions = [
    // 业务用户权限 - 只读访问
    { resource: 'assets', action: 'read', role: UserRole.BUSINESS_USER },
    { resource: 'applications', action: 'read', role: UserRole.BUSINESS_USER },
    { resource: 'applications', action: 'write', role: UserRole.BUSINESS_USER }, // 可以创建申请

    // 资产管理员权限 - 管理资产和申请
    { resource: 'assets', action: 'read', role: UserRole.ASSET_MANAGER },
    { resource: 'assets', action: 'write', role: UserRole.ASSET_MANAGER },
    { resource: 'assets', action: 'delete', role: UserRole.ASSET_MANAGER },
    { resource: 'assets', action: 'manage', role: UserRole.ASSET_MANAGER },
    { resource: 'applications', action: 'read', role: UserRole.ASSET_MANAGER },
    { resource: 'applications', action: 'write', role: UserRole.ASSET_MANAGER },
    { resource: 'applications', action: 'manage', role: UserRole.ASSET_MANAGER },

    // 系统管理员权限 - 全部权限
    { resource: 'assets', action: 'read', role: UserRole.SYSTEM_ADMIN },
    { resource: 'assets', action: 'write', role: UserRole.SYSTEM_ADMIN },
    { resource: 'assets', action: 'delete', role: UserRole.SYSTEM_ADMIN },
    { resource: 'assets', action: 'manage', role: UserRole.SYSTEM_ADMIN },
    { resource: 'applications', action: 'read', role: UserRole.SYSTEM_ADMIN },
    { resource: 'applications', action: 'write', role: UserRole.SYSTEM_ADMIN },
    { resource: 'applications', action: 'manage', role: UserRole.SYSTEM_ADMIN },
    { resource: 'users', action: 'read', role: UserRole.SYSTEM_ADMIN },
    { resource: 'users', action: 'write', role: UserRole.SYSTEM_ADMIN },
    { resource: 'users', action: 'manage', role: UserRole.SYSTEM_ADMIN },
    { resource: 'admin', action: 'read', role: UserRole.SYSTEM_ADMIN },
    { resource: 'admin', action: 'write', role: UserRole.SYSTEM_ADMIN },
    { resource: 'admin', action: 'manage', role: UserRole.SYSTEM_ADMIN },
  ]

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action_role: {
          resource: permission.resource,
          action: permission.action,
          role: permission.role,
        },
      },
      update: {},
      create: permission,
    })
  }

  console.log(`创建了 ${permissions.length} 个权限配置`)

  // 2. 创建测试用户（如果不存在的话）
  console.log('创建测试用户...')

  // 创建系统管理员测试用户
  const adminPasswordHash = await AuthService.hashPassword('admin123')
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@company.com',
      passwordHash: adminPasswordHash,
      name: '系统管理员',
      department: 'IT部门',
      role: UserRole.SYSTEM_ADMIN,
    },
  })

  // 创建资产管理员测试用户
  const managerPasswordHash = await AuthService.hashPassword('manager123')
  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@company.com' },
    update: {},
    create: {
      username: 'manager',
      email: 'manager@company.com',
      passwordHash: managerPasswordHash,
      name: '资产管理员',
      department: '数据部门',
      role: UserRole.ASSET_MANAGER,
    },
  })

  // 创建业务用户测试用户
  const userPasswordHash = await AuthService.hashPassword('user123')
  const businessUser = await prisma.user.upsert({
    where: { email: 'user@company.com' },
    update: {},
    create: {
      username: 'user',
      email: 'user@company.com',
      passwordHash: userPasswordHash,
      name: '业务用户',
      department: '业务部门',
      role: UserRole.BUSINESS_USER,
    },
  })

  console.log('创建的测试用户:')
  console.log(`- 系统管理员: ${adminUser.email} (密码: admin123)`)
  console.log(`- 资产管理员: ${managerUser.email} (密码: manager123)`)
  console.log(`- 业务用户: ${businessUser.email} (密码: user123)`)

  // 3. 创建数据分类
  console.log('创建数据分类...')

  const categories = [
    { code: 'hr', name: 'HR数据域', description: '人力资源相关数据资产' },
    { code: 'finance', name: 'Finance数据域', description: '财务相关数据资产' },
    { code: 'legal', name: 'Legal数据域', description: '法务相关数据资产' },
  ]

  const createdCategories = []
  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { code: cat.code },
      update: {},
      create: {
        ...cat,
        depth: 0,
        sortOrder: createdCategories.length,
        createdBy: adminUser.id,
      },
    })
    createdCategories.push(category)
  }

  console.log(`创建了 ${createdCategories.length} 个数据分类`)

  // 4. 创建模拟资产数据
  console.log('创建模拟资产数据...')

  const statuses: AssetStatus[] = ['AVAILABLE', 'MAINTENANCE', 'DEPRECATED', 'DRAFT']
  const sensitivities: AssetSensitivity[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL']
  const tagOptions = ['用户行为', '日志', '实时', '商品', '维度', '主数据', '订单', '交易', '金融', '客户画像', '标签', 'ML', '营销', '效果', '指标']

  const assets = []
  for (let i = 0; i < 100; i++) {
    const categoryIndex = i % 3
    const statusIndex = i % 4
    const sensitivityIndex = i % 3
    const category = createdCategories[categoryIndex]

    const assetTags = tagOptions.slice(i % 5, (i % 5) + 3)

    const asset = await prisma.asset.upsert({
      where: { code: `ASSET_${String(i + 1).padStart(4, '0')}` },
      update: {},
      create: {
        name: `数据资产 ${i + 1}`,
        code: `ASSET_${String(i + 1).padStart(4, '0')}`,
        description: '这是一个数据资产的详细描述，包含了数据的用途、来源和更新频率等重要信息...',
        status: statuses[statusIndex],
        sensitivity: sensitivities[sensitivityIndex],
        categoryId: category.id,
        type: 'table',
        databaseName: `db_${category.code}`,
        tableName: `table_${i + 1}`,
        size: BigInt(Math.floor((Math.random() * 5 + 0.1) * 1024 * 1024 * 1024)), // GB转字节
        recordCount: BigInt(Math.floor(Math.random() * 1000000)),
        qualityScore: Math.floor(Math.random() * 30) + 70,
        accessCount: Math.floor(Math.random() * 1000),
        tags: JSON.stringify(assetTags),
        createdBy: managerUser.id,
        updatedBy: managerUser.id,
      },
    })
    assets.push(asset)

    if ((i + 1) % 20 === 0) {
      console.log(`已创建 ${i + 1}/100 个资产...`)
    }
  }

  console.log(`创建了 ${assets.length} 个数据资产`)

  console.log('权限系统数据seeding完成!')
}

main()
  .catch((e) => {
    console.error('Seeding失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })