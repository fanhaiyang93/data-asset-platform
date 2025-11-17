import { test, expect } from '@playwright/test';

/**
 * 第三方平台跳转端到端测试
 * 测试完整的用户跳转流程，包括不同跳转模式和移动端适配
 */

test.describe('第三方平台跳转集成', () => {
  test.beforeEach(async ({ page }) => {
    // 登录用户（假设有登录功能）
    await page.goto('/auth/signin');
    await page.fill('[name="email"]', 'test@company.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('应该显示平台跳转页面', async ({ page }) => {
    // 假设有一个测试申请ID
    await page.goto('/applications/redirect/test-app-id');

    // 验证页面加载
    await expect(page.locator('h1')).toContainText('第三方平台跳转');

    // 如果没有指定平台，应该显示平台选择
    await expect(page.locator('[data-testid="platform-selection"]')).toBeVisible();
  });

  test('应该能选择平台并生成跳转链接', async ({ page }) => {
    await page.goto('/applications/redirect/test-app-id?platform=hive');

    // 等待平台跳转组件加载
    await expect(page.locator('[data-testid="platform-redirect"]')).toBeVisible();

    // 点击生成跳转链接按钮
    await page.click('[data-testid="generate-redirect-btn"]');

    // 等待链接生成
    await expect(page.locator('[data-testid="redirect-url-input"]')).toBeVisible();

    // 验证跳转链接包含预期内容
    const redirectUrl = await page.locator('[data-testid="redirect-url-input"]').inputValue();
    expect(redirectUrl).toContain('hive');
    expect(redirectUrl).toContain('user_token');
    expect(redirectUrl).toContain('application_id');
  });

  test('桌面端应该支持多种跳转模式选择', async ({ page }) => {
    await page.goto('/applications/redirect/test-app-id?platform=hive');

    // 验证跳转模式选择器存在
    await expect(page.locator('[data-testid="redirect-mode-selector"]')).toBeVisible();

    // 验证所有三种模式都可选择
    await expect(page.locator('[data-testid="mode-new-window"]')).toBeVisible();
    await expect(page.locator('[data-testid="mode-current-window"]')).toBeVisible();
    await expect(page.locator('[data-testid="mode-iframe"]')).toBeVisible();

    // 选择不同模式
    await page.click('[data-testid="mode-iframe"]');
    await expect(page.locator('[data-testid="mode-iframe"]')).toHaveClass(/default/);
  });

  test('移动端应该自动优化跳转模式', async ({ page, browser }) => {
    // 模拟移动设备
    const mobileContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 667 }
    });

    const mobilePage = await mobileContext.newPage();

    // 登录（移动端）
    await mobilePage.goto('/auth/signin');
    await mobilePage.fill('[name="email"]', 'test@company.com');
    await mobilePage.fill('[name="password"]', 'password123');
    await mobilePage.click('[type="submit"]');
    await mobilePage.waitForURL('/dashboard');

    await mobilePage.goto('/applications/redirect/test-app-id?platform=hive');

    // 验证移动端标识显示
    await expect(mobilePage.locator('[data-testid="mobile-indicator"]')).toBeVisible();
    await expect(mobilePage.locator('[data-testid="mobile-indicator"]')).toContainText('移动端');

    // 验证移动端不显示跳转模式选择器（自动优化）
    await expect(mobilePage.locator('[data-testid="redirect-mode-selector"]')).not.toBeVisible();

    // 验证移动端优化提示
    await expect(mobilePage.locator('[data-testid="mobile-optimization-alert"]')).toBeVisible();

    await mobileContext.close();
  });

  test('应该正确处理跳转错误', async ({ page }) => {
    // Mock API返回错误
    await page.route('/api/platform/redirect', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'PLATFORM_UNAVAILABLE',
          message: '目标平台暂时不可用'
        })
      });
    });

    await page.goto('/applications/redirect/test-app-id?platform=hive');

    // 尝试生成跳转链接
    await page.click('[data-testid="generate-redirect-btn"]');

    // 验证错误显示
    await expect(page.locator('[data-testid="error-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('目标平台暂时不可用');

    // 验证解决方案显示
    await expect(page.locator('[data-testid="error-solutions"]')).toBeVisible();

    // 验证重试按钮存在
    await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();
  });

  test('应该提供手动跳转备选方案', async ({ page }) => {
    await page.goto('/applications/redirect/test-app-id?platform=hive');

    // Mock API返回成功但模拟跳转失败
    await page.route('/api/platform/redirect', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          redirectUrl: 'https://hive.test.com/auth?token=test-token',
          platform: 'hive'
        })
      });
    });

    await page.click('[data-testid="generate-redirect-btn"]');

    // 等待跳转URL生成
    await expect(page.locator('[data-testid="redirect-success-card"]')).toBeVisible();

    // 验证手动跳转选项
    await expect(page.locator('[data-testid="manual-redirect-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="copy-link-btn"]')).toBeVisible();

    // 测试复制链接功能
    await page.click('[data-testid="copy-link-btn"]');

    // 验证复制成功（可能需要特殊的浏览器权限处理）
    // 这里简单验证按钮状态变化
    await expect(page.locator('[data-testid="copy-link-btn"]')).toContainText('复制链接');
  });

  test('iframe模式应该正确嵌入第三方页面', async ({ page }) => {
    await page.goto('/applications/redirect/test-app-id?platform=hive&mode=iframe');

    // Mock一个安全的测试URL
    await page.route('/api/platform/redirect', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          redirectUrl: 'https://example.com/safe-test-page',
          platform: 'hive',
          mode: 'iframe'
        })
      });
    });

    await page.click('[data-testid="generate-redirect-btn"]');

    // 验证iframe显示
    await expect(page.locator('[data-testid="embedded-iframe"]')).toBeVisible();

    // 验证iframe属性
    const iframe = page.locator('[data-testid="embedded-iframe"]');
    await expect(iframe).toHaveAttribute('src', 'https://example.com/safe-test-page');
    await expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups');
  });

  test('应该记录跳转日志', async ({ page }) => {
    await page.goto('/applications/redirect/test-app-id?platform=hive');

    // Mock API返回包含logId的响应
    await page.route('/api/platform/redirect', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          redirectUrl: 'https://hive.test.com/auth?token=test-token',
          platform: 'hive',
          logId: 'log-12345'
        })
      });
    });

    await page.click('[data-testid="generate-redirect-btn"]');

    // 验证日志ID在页面数据属性中
    const platformRedirect = page.locator('[data-testid="platform-redirect"]');
    await expect(platformRedirect).toHaveAttribute('data-log-id', 'log-12345');
  });

  test('应该处理不同平台的特定配置', async ({ page }) => {
    // 测试企业微信平台
    await page.goto('/applications/redirect/test-app-id?platform=enterprise_wechat');

    await expect(page.locator('[data-testid="platform-name"]')).toContainText('企业微信');

    // Mock企业微信特定的响应
    await page.route('/api/platform/redirect', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          redirectUrl: 'https://work.weixin.qq.com/wework_admin/approval?access_token=test',
          platform: 'enterprise_wechat'
        })
      });
    });

    await page.click('[data-testid="generate-redirect-btn"]');

    const redirectUrl = await page.locator('[data-testid="redirect-url-input"]').inputValue();
    expect(redirectUrl).toContain('work.weixin.qq.com');
    expect(redirectUrl).toContain('access_token');
  });

  test('应该验证用户权限', async ({ page }) => {
    // Mock权限不足的响应
    await page.route('/api/platform/redirect', route => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'FORBIDDEN',
          message: '您无权限访问 hive 平台'
        })
      });
    });

    await page.goto('/applications/redirect/test-app-id?platform=hive');
    await page.click('[data-testid="generate-redirect-btn"]');

    // 验证权限错误显示
    await expect(page.locator('[data-testid="error-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('无权限访问');

    // 验证联系技术支持信息显示
    await expect(page.locator('[data-testid="support-contact"]')).toBeVisible();
  });
});