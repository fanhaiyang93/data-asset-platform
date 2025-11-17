import { beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

// 设置测试数据库
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db'
    }
  }
})

beforeAll(async () => {
  // 在测试开始前确保测试数据库存在
  await prisma.$connect()
})

afterAll(async () => {
  // 清理测试数据库
  await prisma.$disconnect()
})

// 将prisma客户端暴露给测试
global.prisma = prisma