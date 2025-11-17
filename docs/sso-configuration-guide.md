# SSO配置指南

## 概述

本文档详细介绍了数据资产管理平台SSO（单点登录）系统的配置方法，包括各种SSO提供商的配置步骤、参数说明和最佳实践。

## 支持的SSO协议

- **SAML 2.0**: 企业级身份提供商（如ADFS、Okta、Azure AD）
- **OAuth 2.0**: 社交登录和现代身份提供商（如Google、GitHub）
- **LDAP/Active Directory**: 传统企业目录服务
- **OpenID Connect**: 基于OAuth 2.0的身份认证协议

## 通用配置步骤

### 1. 访问管理界面

登录系统管理员账户，访问SSO配置页面：

```
https://your-domain.com/admin/sso
```

### 2. 创建SSO提供商

1. 点击"创建SSO提供商"按钮
2. 填写基本信息：
   - **名称**: 提供商的显示名称
   - **类型**: 选择SSO协议类型
   - **状态**: 设置为"测试中"进行配置测试

### 3. 配置详细参数

根据选择的SSO类型，配置相应的参数（详见下文各协议配置）。

### 4. 测试连接

配置完成后，使用"测试连接"功能验证配置的正确性。

### 5. 启用提供商

测试成功后，将状态设置为"活跃"以启用SSO登录。

## SAML 2.0 配置

### 适用场景

- 企业Active Directory Federation Services (ADFS)
- Okta
- Azure Active Directory
- OneLogin
- 其他企业级身份提供商

### 配置参数

#### 基础配置

| 参数 | 描述 | 示例 |
|------|------|------|
| Entity ID | SAML实体标识符 | `https://your-domain.com/saml/metadata` |
| SSO URL | 身份提供商的单点登录地址 | `https://idp.company.com/saml/sso` |
| SLO URL | 单点登出地址（可选） | `https://idp.company.com/saml/slo` |
| X.509 证书 | 用于验证SAML断言的公钥证书 | PEM格式证书内容 |

#### SAML元数据获取

大多数SAML提供商都提供元数据URL，可以自动配置：

```xml
<!-- 示例SAML元数据 -->
<EntityDescriptor entityID="https://idp.company.com">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="https://idp.company.com/saml/sso"/>
    <KeyDescriptor use="signing">
      <KeyInfo>
        <X509Data>
          <X509Certificate>MIIDxTCCAq2gAwIBAgI...</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
  </IDPSSODescriptor>
</EntityDescriptor>
```

### 常见SAML提供商配置

#### Azure Active Directory

1. **在Azure AD中创建企业应用程序**
   - 登录Azure门户
   - 转到"Azure Active Directory" > "企业应用程序"
   - 点击"新建应用程序" > "非库应用程序"

2. **配置SAML单点登录**
   - 选择"单点登录" > "SAML"
   - 基本SAML配置：
     - 标识符：`https://your-domain.com/saml/metadata`
     - 回复URL：`https://your-domain.com/api/auth/saml/callback`
     - 登录URL：`https://your-domain.com/auth/saml`

3. **获取Azure AD信息**
   - 登录URL：从Azure AD复制
   - Azure AD标识符：从Azure AD复制
   - 证书：下载签名证书

4. **属性映射**
   ```
   user.mail -> email
   user.displayname -> name
   user.department -> department
   user.jobtitle -> title
   ```

#### Okta配置

1. **创建Okta应用程序**
   - 登录Okta管理控制台
   - 转到"Applications" > "Add Application"
   - 选择"SAML 2.0"

2. **应用程序设置**
   - Single sign on URL：`https://your-domain.com/api/auth/saml/callback`
   - Audience URI：`https://your-domain.com/saml/metadata`
   - Name ID format：EmailAddress

3. **属性声明配置**
   ```
   email -> user.email
   firstName -> user.firstName
   lastName -> user.lastName
   department -> user.department
   ```

4. **获取Okta元数据**
   - 从Okta应用程序的"Sign On"选项卡获取元数据URL
   - 或下载IdP元数据文件

#### ADFS配置

1. **创建依赖方信任**
   ```powershell
   # PowerShell命令创建依赖方信任
   Add-ADFSRelyingPartyTrust `
     -Name "Data Asset Platform" `
     -Identifier "https://your-domain.com/saml/metadata" `
     -SamlEndpoint @(
       New-ADFSSamlEndpoint `
         -Protocol "SAMLAssertionConsumer" `
         -Uri "https://your-domain.com/api/auth/saml/callback" `
         -Binding "POST"
     )
   ```

2. **配置声明规则**
   ```
   # 发送LDAP属性作为声明
   c:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname"]
   => issue(Type = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
            Issuer = c.Issuer,
            OriginalIssuer = c.OriginalIssuer,
            Value = c.Value,
            ValueType = c.ValueType);

   # 发送邮箱地址
   c:[Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]
   => issue(claim = c);
   ```

### SAML属性映射

配置属性映射以将SAML断言中的属性映射到系统用户字段：

| 系统字段 | SAML属性 | 描述 |
|----------|----------|------|
| email | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | 用户邮箱 |
| name | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` | 显示名称 |
| department | `http://schemas.microsoft.com/ws/2008/06/identity/claims/department` | 部门信息 |
| title | `http://schemas.microsoft.com/ws/2008/06/identity/claims/title` | 职位信息 |

## OAuth 2.0 配置

### 适用场景

- Google OAuth
- GitHub OAuth
- Microsoft OAuth
- 自定义OAuth提供商

### 配置参数

| 参数 | 描述 | 示例 |
|------|------|------|
| Client ID | OAuth应用程序标识符 | `your-client-id` |
| Client Secret | OAuth应用程序密钥 | `your-client-secret` |
| 授权URL | OAuth授权端点 | `https://accounts.google.com/oauth2/auth` |
| Token URL | 令牌获取端点 | `https://oauth2.googleapis.com/token` |
| 用户信息URL | 用户信息获取端点 | `https://www.googleapis.com/oauth2/v2/userinfo` |
| Scopes | 请求的权限范围 | `openid email profile` |

### Google OAuth配置

1. **创建Google OAuth应用**
   - 访问[Google Cloud Console](https://console.cloud.google.com/)
   - 转到"APIs & Services" > "Credentials"
   - 点击"Create Credentials" > "OAuth 2.0 Client IDs"

2. **配置OAuth同意屏幕**
   - 应用程序名称：Data Asset Platform
   - 用户支持邮箱：support@company.com
   - 授权域：your-domain.com

3. **OAuth客户端配置**
   - 应用程序类型：Web application
   - 授权重定向URI：`https://your-domain.com/api/auth/callback/google`

4. **系统配置**
   ```
   Client ID: 从Google Console获取
   Client Secret: 从Google Console获取
   授权URL: https://accounts.google.com/oauth2/auth
   Token URL: https://oauth2.googleapis.com/token
   用户信息URL: https://www.googleapis.com/oauth2/v2/userinfo
   Scopes: openid email profile
   ```

### GitHub OAuth配置

1. **创建GitHub OAuth应用**
   - 登录GitHub，转到Settings > Developer settings > OAuth Apps
   - 点击"New OAuth App"

2. **应用程序设置**
   - Application name：Data Asset Platform
   - Homepage URL：https://your-domain.com
   - Authorization callback URL：`https://your-domain.com/api/auth/callback/github`

3. **系统配置**
   ```
   Client ID: 从GitHub获取
   Client Secret: 从GitHub获取
   授权URL: https://github.com/login/oauth/authorize
   Token URL: https://github.com/login/oauth/access_token
   用户信息URL: https://api.github.com/user
   Scopes: user:email
   ```

### Microsoft OAuth配置

1. **Azure AD应用注册**
   - 登录Azure门户
   - 转到"Azure Active Directory" > "应用注册"
   - 点击"新注册"

2. **应用程序配置**
   - 名称：Data Asset Platform
   - 支持的帐户类型：任何组织目录中的帐户
   - 重定向URI：`https://your-domain.com/api/auth/callback/microsoft`

3. **API权限配置**
   - 添加权限：Microsoft Graph
   - 委派权限：User.Read, email, openid, profile

4. **系统配置**
   ```
   Client ID: 应用程序（客户端）ID
   Client Secret: 在"证书和密码"中创建
   授权URL: https://login.microsoftonline.com/common/oauth2/v2.0/authorize
   Token URL: https://login.microsoftonline.com/common/oauth2/v2.0/token
   用户信息URL: https://graph.microsoft.com/v1.0/me
   Scopes: openid email profile User.Read
   ```

## LDAP配置

### 适用场景

- Active Directory
- OpenLDAP
- Apache Directory Server
- Oracle Directory Server

### 配置参数

| 参数 | 描述 | 示例 |
|------|------|------|
| LDAP服务器URL | LDAP服务器地址 | `ldap://dc.company.com:389` |
| Base DN | 搜索基础DN | `dc=company,dc=com` |
| Bind DN | 绑定用户DN（可选） | `cn=ldapuser,ou=service,dc=company,dc=com` |
| Bind密码 | 绑定用户密码（可选） | `secure-password` |
| 用户过滤器 | 用户搜索过滤器 | `(sAMAccountName={username})` |

### Active Directory配置

1. **服务器连接配置**
   ```
   LDAP服务器URL: ldap://dc.company.com:389
   # 或使用LDAPS加密连接
   LDAP服务器URL: ldaps://dc.company.com:636
   ```

2. **搜索配置**
   ```
   Base DN: dc=company,dc=com
   用户过滤器: (sAMAccountName={username})
   # 或使用邮箱登录
   用户过滤器: (mail={username})
   ```

3. **服务账户配置（推荐）**
   ```
   Bind DN: cn=sso-service,ou=service accounts,dc=company,dc=com
   Bind密码: your-service-account-password
   ```

4. **属性映射配置**
   ```
   email: mail
   name: displayName
   department: department
   title: title
   phone: telephoneNumber
   ```

### OpenLDAP配置

1. **服务器连接配置**
   ```
   LDAP服务器URL: ldap://ldap.company.com:389
   Base DN: ou=people,dc=company,dc=com
   ```

2. **用户过滤器**
   ```
   # 使用UID属性
   用户过滤器: (uid={username})

   # 使用邮箱属性
   用户过滤器: (mail={username})
   ```

3. **属性映射**
   ```
   email: mail
   name: cn
   department: ou
   title: title
   ```

### LDAP安全配置

1. **启用TLS/SSL**
   ```
   # 使用LDAPS
   LDAP服务器URL: ldaps://ldap.company.com:636

   # 或使用StartTLS
   LDAP服务器URL: ldap://ldap.company.com:389
   启用StartTLS: true
   ```

2. **证书验证**
   - 在生产环境中启用证书验证
   - 配置受信任的CA证书
   - 验证服务器证书的有效性

## OpenID Connect配置

### 适用场景

- Auth0
- Keycloak
- IdentityServer
- 自定义OIDC提供商

### 配置参数

OpenID Connect基于OAuth 2.0，但提供了标准化的用户信息获取方式。

| 参数 | 描述 | 示例 |
|------|------|------|
| Issuer URL | OIDC发现端点 | `https://auth.company.com/.well-known/openid_configuration` |
| Client ID | OIDC客户端标识符 | `your-client-id` |
| Client Secret | OIDC客户端密钥 | `your-client-secret` |

### Auth0配置

1. **创建Auth0应用程序**
   - 登录Auth0 Dashboard
   - 转到Applications > Create Application
   - 选择"Regular Web Applications"

2. **应用程序设置**
   ```
   Name: Data Asset Platform
   Application Type: Regular Web Applications
   Allowed Callback URLs: https://your-domain.com/api/auth/callback/auth0
   Allowed Logout URLs: https://your-domain.com
   Allowed Web Origins: https://your-domain.com
   ```

3. **系统配置**
   ```
   Issuer URL: https://your-tenant.auth0.com/.well-known/openid_configuration
   Client ID: 从Auth0获取
   Client Secret: 从Auth0获取
   Scopes: openid email profile
   ```

### Keycloak配置

1. **创建Keycloak客户端**
   - 登录Keycloak管理控制台
   - 选择Realm > Clients > Create

2. **客户端配置**
   ```
   Client ID: data-asset-platform
   Client Protocol: openid-connect
   Access Type: confidential
   Valid Redirect URIs: https://your-domain.com/api/auth/callback/keycloak
   ```

3. **系统配置**
   ```
   Issuer URL: https://keycloak.company.com/auth/realms/your-realm/.well-known/openid_configuration
   Client ID: data-asset-platform
   Client Secret: 从Keycloak获取
   Scopes: openid email profile
   ```

## 角色映射配置

### 基于属性的角色映射

系统支持基于SSO用户属性自动分配角色：

#### 映射规则配置

1. **访问角色映射配置**
   - 转到SSO管理 > 权限管理 > 角色映射规则

2. **创建映射规则**
   - 条件属性：选择用户属性（如groups、department）
   - 操作符：equals、contains、startsWith等
   - 条件值：匹配的属性值
   - 目标角色：系统角色（系统管理员、数据管理员、业务用户）

#### 示例映射规则

```yaml
# 管理员权限映射
- 条件:
    属性: groups
    操作符: contains
    值: "admin"
  目标角色: 系统管理员
  优先级: 1

# 数据管理员权限映射
- 条件:
    属性: department
    操作符: equals
    值: "IT"
  目标角色: 数据管理员
  优先级: 2

# 基于邮箱域名的权限映射
- 条件:
    属性: email
    操作符: endsWith
    值: "@admin.company.com"
  目标角色: 数据管理员
  优先级: 3
```

### 静态角色映射

也可以在SSO提供商配置中设置静态角色映射：

```yaml
角色映射:
  "Domain Admins": "系统管理员"
  "IT Department": "数据管理员"
  "Business Users": "业务用户"
```

## 高级配置

### 多提供商配置

系统支持配置多个SSO提供商，用户可以选择使用哪个提供商登录：

1. **配置多个提供商**
   - 为不同用户群体配置不同的SSO提供商
   - 例如：内部员工使用AD SAML，外部合作伙伴使用Google OAuth

2. **登录页面配置**
   - 系统会自动显示所有活跃的SSO提供商
   - 用户可以选择相应的提供商进行登录

### 会话管理

#### 会话超时配置

```env
# 会话超时时间（秒）
SESSION_TIMEOUT=3600

# 滑动会话（用户活动时重置超时）
SESSION_SLIDING=true

# 记住我功能超时时间（秒）
REMEMBER_ME_TIMEOUT=2592000
```

#### 跨域会话共享

如果需要在多个子域名间共享会话：

```env
# 会话Cookie域名设置
SESSION_COOKIE_DOMAIN=.company.com

# 会话Cookie安全设置
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=strict
```

### 安全配置

#### 证书管理

1. **SAML证书轮换**
   - 定期更新SAML签名证书
   - 支持证书链验证
   - 自动检测证书过期

2. **OAuth密钥管理**
   - 定期轮换Client Secret
   - 使用安全的密钥存储
   - 监控密钥使用情况

#### 访问控制

```yaml
# IP白名单配置
allowed_ips:
  - "192.168.1.0/24"
  - "10.0.0.0/8"

# 时间限制配置
access_hours:
  start: "08:00"
  end: "18:00"
  timezone: "Asia/Shanghai"

# 设备限制
max_concurrent_sessions: 3
device_trust_required: false
```

## 测试和验证

### 连接测试

1. **SAML连接测试**
   - 验证元数据URL可访问性
   - 测试SAML断言解析
   - 验证证书有效性

2. **OAuth连接测试**
   - 测试授权流程
   - 验证令牌获取
   - 检查用户信息获取

3. **LDAP连接测试**
   - 测试服务器连接
   - 验证用户认证
   - 检查属性获取

### 用户登录测试

1. **创建测试用户**
   - 在身份提供商中创建测试账户
   - 配置必要的属性和权限

2. **登录流程测试**
   - 访问登录页面
   - 选择SSO提供商
   - 完成认证流程
   - 验证用户信息和权限

3. **登出测试**
   - 测试单点登出功能
   - 验证会话清理
   - 检查重定向行为

## 故障排除

### 常见问题

1. **SAML断言验证失败**
   - 检查时钟同步
   - 验证证书配置
   - 检查Audience限制

2. **OAuth回调失败**
   - 验证回调URL配置
   - 检查Client ID和Secret
   - 确认授权范围设置

3. **LDAP认证失败**
   - 检查服务器连接
   - 验证Bind凭据
   - 确认用户过滤器

4. **属性映射问题**
   - 检查属性名称匹配
   - 验证属性值格式
   - 确认映射规则配置

### 调试工具

1. **日志查看**
   ```bash
   # 查看SSO认证日志
   tail -f /var/log/sso/auth.log

   # 查看错误日志
   tail -f /var/log/sso/error.log
   ```

2. **SAML调试**
   - 使用SAML调试工具验证断言
   - 检查SAML响应格式
   - 验证签名和加密

3. **网络调试**
   ```bash
   # 测试LDAP连接
   ldapsearch -H ldap://server:389 -D "bind-dn" -W -b "base-dn" "(uid=testuser)"

   # 测试HTTP连接
   curl -I https://idp.company.com/saml/metadata
   ```

## 最佳实践

### 安全最佳实践

1. **使用HTTPS**
   - 所有SSO通信必须使用HTTPS
   - 配置HSTS头
   - 使用有效的SSL证书

2. **证书管理**
   - 定期轮换签名证书
   - 监控证书过期时间
   - 使用强加密算法

3. **访问控制**
   - 实施最小权限原则
   - 定期审核用户权限
   - 监控异常登录活动

### 性能最佳实践

1. **缓存配置**
   - 缓存用户会话信息
   - 缓存SSO提供商元数据
   - 使用Redis进行分布式缓存

2. **连接池**
   - 配置LDAP连接池
   - 优化数据库连接
   - 监控连接使用情况

3. **负载均衡**
   - 配置多个应用实例
   - 使用会话粘性
   - 监控服务健康状态

### 运维最佳实践

1. **监控告警**
   - 监控SSO成功率
   - 设置响应时间告警
   - 监控错误率变化

2. **日志管理**
   - 集中化日志收集
   - 设置日志轮转
   - 保护敏感信息

3. **备份恢复**
   - 定期备份配置
   - 测试恢复流程
   - 文档化恢复步骤

## 支持和维护

### 技术支持

如需配置帮助，请联系：
- 技术支持邮箱：sso-support@company.com
- 在线文档：https://docs.company.com/sso/configuration
- 社区论坛：https://community.company.com/sso

### 更新和维护

- 定期检查SSO提供商的配置更新
- 关注安全公告和补丁
- 测试新版本的兼容性
- 维护配置文档的最新性