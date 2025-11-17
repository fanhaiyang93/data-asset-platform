import { test, expect } from '@playwright/test'

/**
 * 申请历史记录端到端测试
 * 测试申请历史列表、筛选、详情查看、导出等完整流程
 */

test.describe('申请历史记录功能', () => {
  test.beforeEach(async ({ page }) => {
    // 登录用户
    await page.goto('/auth/signin')
    await page.fill('[name="email"]', 'test@company.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('应该显示申请历史列表页面', async ({ page }) => {
    await page.goto('/applications/history')

    // 验证页面基本元素
    await expect(page.locator('h1')).toContainText('申请历史记录')
    await expect(page.locator('[data-testid="application-filter"]')).toBeVisible()
    await expect(page.locator('[data-testid="application-history-list"]')).toBeVisible()

    // 验证标签页
    await expect(page.locator('text=申请列表')).toBeVisible()
    await expect(page.locator('text=统计分析')).toBeVisible()
    await expect(page.locator('text=导出管理')).toBeVisible()
  })

  test('应该能够使用筛选功能', async ({ page }) => {
    await page.goto('/applications/history')

    // 展开筛选器
    await page.click('text=展开筛选')

    // 测试关键词搜索
    await page.fill('[placeholder*="搜索申请编号"]', 'DA-20240101')
    await page.waitForTimeout(1000) // 等待搜索结果

    // 测试状态筛选
    await page.check('[id="status-APPROVED"]')
    await page.waitForTimeout(1000)

    // 测试时间范围筛选
    await page.click('text=本月')
    await page.waitForTimeout(1000)

    // 验证筛选器状态
    await expect(page.locator('[data-testid="active-filter-count"]')).toBeVisible()
  })

  test('应该能够查看申请详情', async ({ page }) => {
    await page.goto('/applications/history')

    // 等待申请列表加载
    await page.waitForSelector('[data-testid="application-item"]')

    // 点击第一个申请项
    await page.click('[data-testid="application-item"]:first-child')

    // 验证详情页面
    await expect(page.locator('h1')).toContainText('申请详情')
    await expect(page.locator('text=基本信息')).toBeVisible()
    await expect(page.locator('text=申请人信息')).toBeVisible()
    await expect(page.locator('text=申请进度时间线')).toBeVisible()

    // 验证时间线显示
    await expect(page.locator('[data-testid="timeline-node"]')).toHaveCount.greaterThan(0)
  })

  test('应该能够批量选择和导出', async ({ page }) => {
    await page.goto('/applications/history')

    // 等待申请列表加载
    await page.waitForSelector('[data-testid="application-item"]')

    // 选择第一个申请
    await page.check('[data-testid="application-item"]:first-child [type="checkbox"]')

    // 验证批量操作栏显示
    await expect(page.locator('[data-testid="batch-actions"]')).toBeVisible()
    await expect(page.locator('text=已选择 1 个申请')).toBeVisible()

    // 测试导出选中项
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="export-selected-btn"]')
    const download = await downloadPromise

    // 验证下载文件
    expect(download.suggestedFilename()).toMatch(/申请记录_\d{8}_\d{6}\.csv/)
  })

  test('应该能够查看统计分析', async ({ page }) => {
    await page.goto('/applications/history')

    // 切换到统计分析标签页
    await page.click('text=统计分析')

    // 验证统计卡片
    await expect(page.locator('[data-testid="stats-card"]')).toHaveCount.greaterThanOrEqual(4)
    await expect(page.locator('text=总申请数')).toBeVisible()
    await expect(page.locator('text=通过率')).toBeVisible()
    await expect(page.locator('text=待审核')).toBeVisible()
    await expect(page.locator('text=本月申请')).toBeVisible()

    // 验证分布图表
    await expect(page.locator('text=申请状态分布')).toBeVisible()
    await expect(page.locator('text=业务用途分布')).toBeVisible()
  })

  test('应该能够使用导出管理功能', async ({ page }) => {
    await page.goto('/applications/history')

    // 切换到导出管理标签页
    await page.click('text=导出管理')

    // 设置筛选条件
    await page.click('text=展开筛选')
    await page.check('[id="status-APPROVED"]')
    await page.waitForTimeout(1000)

    // 验证导出预览
    await expect(page.locator('[data-testid="export-preview"]')).toBeVisible()
    await expect(page.locator('text=总记录数')).toBeVisible()
    await expect(page.locator('text=预估大小')).toBeVisible()

    // 测试CSV导出
    const downloadPromise = page.waitForEvent('download')
    await page.click('text=导出为CSV')
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/申请记录.*\.csv/)
  })

  test('应该能够处理无数据情况', async ({ page }) => {
    await page.goto('/applications/history')

    // 设置一个不会匹配任何数据的筛选条件
    await page.fill('[placeholder*="搜索申请编号"]', 'NONEXISTENT-APPLICATION-ID')
    await page.waitForTimeout(1000)

    // 验证空状态显示
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible()
    await expect(page.locator('text=暂无申请记录')).toBeVisible()
  })

  test('应该能够使用时间线功能', async ({ page }) => {
    await page.goto('/applications/history')

    // 等待并点击一个已审核的申请
    await page.waitForSelector('[data-testid="application-item"][data-status="APPROVED"]')
    await page.click('[data-testid="application-item"][data-status="APPROVED"]:first-child')

    // 验证时间线完整性
    await expect(page.locator('[data-testid="timeline-node-created"]')).toBeVisible()
    await expect(page.locator('[data-testid="timeline-node-submitted"]')).toBeVisible()
    await expect(page.locator('[data-testid="timeline-node-approved"]')).toBeVisible()

    // 验证时间线信息
    await expect(page.locator('text=创建申请')).toBeVisible()
    await expect(page.locator('text=提交申请')).toBeVisible()
    await expect(page.locator('text=申请通过')).toBeVisible()

    // 验证进度显示
    await expect(page.locator('[data-testid="overall-progress"]')).toBeVisible()
    await expect(page.locator('text=整体进度')).toBeVisible()
  })

  test('应该能够复制申请编号', async ({ page }) => {
    await page.goto('/applications/history')

    // 进入申请详情
    await page.waitForSelector('[data-testid="application-item"]')
    await page.click('[data-testid="application-item"]:first-child')

    // 测试复制申请编号功能
    await page.click('[data-testid="copy-application-number"]')

    // 验证复制成功提示（如果有toast通知）
    await expect(page.locator('text=已复制到剪贴板')).toBeVisible({ timeout: 3000 })
  })

  test('应该能够处理加载状态', async ({ page }) => {
    // 拦截API请求以模拟加载状态
    await page.route('/api/trpc/application.getUserApplicationHistory*', route => {
      // 延迟2秒再响应
      setTimeout(() => {
        route.continue()
      }, 2000)
    })

    await page.goto('/applications/history')

    // 验证加载骨架屏显示
    await expect(page.locator('[data-testid="application-skeleton"]')).toBeVisible()

    // 等待加载完成
    await page.waitForSelector('[data-testid="application-item"]', { timeout: 5000 })
  })

  test('应该能够处理错误状态', async ({ page }) => {
    // 拦截API请求并返回错误
    await page.route('/api/trpc/application.getUserApplicationHistory*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })

    await page.goto('/applications/history')

    // 验证错误状态显示
    await expect(page.locator('[data-testid="error-alert"]')).toBeVisible()
    await expect(page.locator('text=加载申请历史失败')).toBeVisible()
    await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible()
  })

  test('应该支持响应式设计', async ({ page }) => {
    await page.goto('/applications/history')

    // 测试移动端视图
    await page.setViewportSize({ width: 375, height: 667 })

    // 验证移动端布局调整
    await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible()

    // 测试筛选器在移动端的行为
    await page.click('text=展开筛选')
    await expect(page.locator('[data-testid="mobile-filter-drawer"]')).toBeVisible()

    // 恢复桌面端视图
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible()
  })

  test('应该能够进行虚拟滚动', async ({ page }) => {
    await page.goto('/applications/history')

    // 等待列表加载
    await page.waitForSelector('[data-testid="virtual-list"]')

    // 滚动到底部触发加载更多
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('[data-testid="virtual-list"]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    })

    // 验证加载更多指示器
    await expect(page.locator('text=加载更多申请记录')).toBeVisible({ timeout: 3000 })
  })
})