# SSO 故障排除手册

## 概述

本手册提供了SSO系统常见问题的诊断和解决方案，帮助系统管理员快速定位和解决SSO相关故障。

## 快速诊断检查清单

### 系统状态检查
```bash
# 1. 检查系统状态
curl -X POST http://localhost:3000/api/admin/sso/monitoring \
  -H "Content-Type: application/json" \
  -d '{"action": "health_check"}'

# 2. 检查数据库连接
npx prisma db push --preview-feature

# 3. 检查环境变量
echo $DATABASE_URL
echo $NEXTAUTH_SECRET
echo $SSO_ENCRYPTION_KEY
```

### 日志检查
```bash
# 查看应用日志
tail -f logs/app.log | grep -i sso

# 查看错误日志
tail -f logs/error.log | grep -i sso

# 查看系统日志
journalctl -u data-asset-platform -f
```

## 常见问题诊断

### 1. 用户无法登录

#### 问题表现
- 用户点击SSO登录按钮后无响应
- 重定向到错误页面
- 认证失败错误

#### 诊断步骤

**1.1 检查SSO提供商状态**
```bash
# 检查提供商配置
curl -X GET "http://localhost:3000/api/admin/sso/providers" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**1.2 验证网络连接**
```bash
# 测试与SSO提供商的连接
curl -I https://your-sso-provider.com/auth

# 检查DNS解析
nslookup your-sso-provider.com

# 测试端口连接
telnet your-sso-provider.com 443
```

**1.3 检查证书有效性**
```bash
# 检查SSL证书
openssl s_client -connect your-sso-provider.com:443 -servername your-sso-provider.com

# 验证证书链
openssl verify -CAfile ca-bundle.crt your-cert.crt
```

#### 解决方案

**方案1：提供商配置问题**
```typescript
// 检查配置文件
{
  "saml": {
    "entryPoint": "https://correct-sso-url.com/saml/sso",
    "issuer": "correct-issuer-name",
    "cert": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
  }
}
```

**方案2：网络问题**
- 检查防火墙规则
- 验证代理设置
- 确认DNS配置

**方案3：证书问题**
- 更新过期证书
- 验证证书链完整性
- 检查证书格式

### 2. 认证成功但权限异常

#### 问题表现
- 用户能够登录但无法访问资源
- 权限映射失败
- 角色分配错误

#### 诊断步骤

**2.1 检查用户属性**
```sql
-- 查看用户SSO属性
SELECT * FROM "SSOLog"
WHERE "userId" = 'user-id'
AND "action" = 'LOGIN_SUCCESS'
ORDER BY "timestamp" DESC
LIMIT 5;
```

**2.2 验证角色映射规则**
```sql
-- 检查角色映射配置
SELECT * FROM "SSORoleMapping"
WHERE "providerId" = 'your-provider-id'
AND "isActive" = true;
```

**2.3 调试权限同步**
```typescript
// 在日志中查看同步过程
await SSORoleMappingService.syncUserPermissions('user-id', {
  debug: true
});
```

#### 解决方案

**方案1：更新角色映射规则**
```json
{
  "condition": {
    "attribute": "department",
    "operator": "equals",
    "value": "IT"
  },
  "targetRole": "ADMIN",
  "priority": 1
}
```

**方案2：手动权限同步**
```bash
# 运行权限同步脚本
node scripts/sync-user-permissions.js --userId=user-id
```

### 3. 性能问题

#### 问题表现
- SSO登录响应缓慢
- 超时错误
- 系统负载过高

#### 诊断步骤

**3.1 监控响应时间**
```bash
# 监控API响应时间
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/api/auth/signin"
```

**3.2 检查数据库性能**
```sql
-- 查看慢查询
SELECT * FROM pg_stat_statements
WHERE query LIKE '%SSO%'
ORDER BY mean_time DESC;

-- 检查索引使用情况
EXPLAIN ANALYZE SELECT * FROM "SSOLog"
WHERE "providerId" = 'provider-id';
```

**3.3 监控系统资源**
```bash
# CPU和内存使用情况
top -p $(pgrep -f "data-asset-platform")

# 磁盘I/O
iotop -p $(pgrep -f "data-asset-platform")
```

#### 解决方案

**方案1：数据库优化**
```sql
-- 添加必要索引
CREATE INDEX idx_sso_log_provider_timestamp
ON "SSOLog"("providerId", "timestamp");

CREATE INDEX idx_sso_session_user_status
ON "SSOSession"("userId", "status");
```

**方案2：缓存配置**
```javascript
// 启用Redis缓存
const cacheConfig = {
  store: 'redis',
  host: 'localhost',
  port: 6379,
  ttl: 300 // 5分钟
};
```

**方案3：连接池优化**
```javascript
// 调整数据库连接池
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  connection_limit = 20
  pool_timeout = 30
}
```

### 4. 证书和加密问题

#### 问题表现
- 证书验证失败
- 加密/解密错误
- 数字签名验证失败

#### 诊断步骤

**4.1 验证证书格式**
```bash
# 检查PEM格式证书
openssl x509 -in certificate.pem -text -noout

# 检查私钥格式
openssl rsa -in private-key.pem -check

# 验证证书和私钥匹配
openssl x509 -noout -modulus -in certificate.pem | openssl md5
openssl rsa -noout -modulus -in private-key.pem | openssl md5
```

**4.2 测试加密功能**
```javascript
// 测试加密/解密功能
const { encrypt, decrypt } = require('../src/lib/encryption');

const testData = 'test-string';
const encrypted = encrypt(testData);
const decrypted = decrypt(encrypted);

console.log('Original:', testData);
console.log('Encrypted:', encrypted);
console.log('Decrypted:', decrypted);
console.log('Match:', testData === decrypted);
```

#### 解决方案

**方案1：证书格式转换**
```bash
# DER转PEM
openssl x509 -inform der -in certificate.cer -out certificate.pem

# PKCS#12转PEM
openssl pkcs12 -in certificate.p12 -out certificate.pem -nodes
```

**方案2：更新加密密钥**
```bash
# 生成新的加密密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 更新环境变量
export SSO_ENCRYPTION_KEY="your-new-key"
```

### 5. 会话管理问题

#### 问题表现
- 用户会话意外过期
- 单点注销失败
- 会话重复或冲突

#### 诊断步骤

**5.1 检查会话配置**
```sql
-- 查看活跃会话
SELECT * FROM "SSOSession"
WHERE "status" = 'ACTIVE'
AND "expiresAt" > NOW();

-- 检查会话冲突
SELECT "userId", COUNT(*) as session_count
FROM "SSOSession"
WHERE "status" = 'ACTIVE'
GROUP BY "userId"
HAVING COUNT(*) > 1;
```

**5.2 验证会话清理**
```javascript
// 检查会话清理任务
const expiredSessions = await SSOSessionService.cleanupExpiredSessions();
console.log(`清理了 ${expiredSessions} 个过期会话`);
```

#### 解决方案

**方案1：调整会话超时**
```javascript
// 更新会话配置
const sessionConfig = {
  maxAge: 8 * 60 * 60, // 8小时
  rolling: true,
  cleanup: {
    interval: 15 * 60 * 1000 // 15分钟清理一次
  }
};
```

**方案2：实现单点注销**
```javascript
// 确保SLO端点正确配置
app.post('/api/auth/slo', async (req, res) => {
  const { sessionId } = req.body;
  await SSOSessionService.invalidateSession(sessionId);
  res.json({ success: true });
});
```

## 错误代码对照表

| 错误代码 | 描述 | 可能原因 | 解决方案 |
|---------|------|----------|----------|
| SSO_001 | 提供商配置无效 | 配置参数错误 | 检查配置格式和必填字段 |
| SSO_002 | 证书验证失败 | 证书过期或格式错误 | 更新证书或转换格式 |
| SSO_003 | 网络连接超时 | 网络问题或防火墙阻塞 | 检查网络连接和防火墙规则 |
| SSO_004 | 权限映射失败 | 映射规则配置错误 | 更新角色映射规则 |
| SSO_005 | 会话验证失败 | 会话过期或被篡改 | 清理过期会话，检查会话存储 |
| SSO_006 | 加密解密错误 | 密钥错误或算法不匹配 | 验证加密密钥和算法配置 |
| SSO_007 | 数据库连接失败 | 数据库服务异常 | 检查数据库状态和连接配置 |
| SSO_008 | 用户属性缺失 | SSO提供商返回属性不完整 | 检查属性映射配置 |

## 监控和告警配置

### 设置关键指标监控

```javascript
// 配置告警规则
const alertRules = [
  {
    name: '登录失败率过高',
    condition: {
      metric: 'failed_login_rate',
      operator: 'gt',
      threshold: 20,
      timeWindow: 10
    },
    actions: [
      {
        type: 'email',
        target: 'admin@company.com'
      }
    ]
  },
  {
    name: '响应时间异常',
    condition: {
      metric: 'response_time',
      operator: 'gt',
      threshold: 5000,
      timeWindow: 5
    },
    actions: [
      {
        type: 'webhook',
        target: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
      }
    ]
  }
];
```

### 日志级别配置

```javascript
// 生产环境日志配置
const logConfig = {
  level: 'info',
  format: 'json',
  outputs: [
    {
      type: 'file',
      filename: 'logs/sso.log',
      maxsize: '100MB',
      maxFiles: 10
    },
    {
      type: 'elasticsearch',
      host: 'localhost:9200',
      index: 'sso-logs'
    }
  ]
};
```

## 维护和预防

### 定期维护任务

```bash
#!/bin/bash
# sso-maintenance.sh - 定期维护脚本

# 1. 清理过期会话
echo "清理过期会话..."
node scripts/cleanup-sessions.js

# 2. 更新证书检查
echo "检查证书有效期..."
node scripts/check-certificates.js

# 3. 备份配置
echo "备份SSO配置..."
pg_dump -t "SSOProvider" -t "SSORoleMapping" > backups/sso-config-$(date +%Y%m%d).sql

# 4. 性能报告
echo "生成性能报告..."
node scripts/performance-report.js

echo "维护任务完成"
```

### 预防措施

1. **证书管理**
   - 设置证书过期提醒（提前30天）
   - 建立证书轮换流程
   - 维护证书备份

2. **配置管理**
   - 使用版本控制管理配置变更
   - 建立配置变更审批流程
   - 定期备份配置数据

3. **监控告警**
   - 设置关键指标阈值
   - 建立告警升级机制
   - 定期测试告警功能

4. **安全审计**
   - 定期安全扫描
   - 访问日志审计
   - 权限定期审查

## 联系支持

### 内部支持
- 技术支持邮箱：tech-support@company.com
- 紧急联系电话：400-xxx-xxxx
- 内部文档：https://wiki.company.com/sso

### 外部资源
- SSO标准文档：https://docs.oasis-open.org/security/saml/
- OAuth 2.0规范：https://tools.ietf.org/html/rfc6749
- OpenID Connect：https://openid.net/connect/

---

**文档版本：** 1.0
**最后更新：** 2024年11月
**维护人员：** 系统管理团队