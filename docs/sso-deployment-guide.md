# SSO系统部署指南

## 概述

本文档提供了数据资产管理平台SSO（单点登录）系统的完整部署指南，包括环境准备、配置说明、部署步骤和常见问题解决方案。

## 系统要求

### 硬件要求

- **CPU**: 最低2核，推荐4核或以上
- **内存**: 最低4GB，推荐8GB或以上
- **存储**: 最低10GB可用空间，推荐SSD存储
- **网络**: 稳定的网络连接，支持HTTPS

### 软件要求

- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Windows Server 2019+
- **Node.js**: 版本18.0+
- **数据库**: PostgreSQL 13+ 或 SQLite 3+
- **反向代理**: Nginx 1.18+ 或 Apache 2.4+
- **SSL证书**: 用于HTTPS连接

## 环境准备

### 1. 安装Node.js

#### Ubuntu/Debian
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### CentOS/RHEL
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

#### Windows
从官网下载并安装Node.js：https://nodejs.org/

### 2. 数据库安装

#### PostgreSQL安装
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

#### 创建数据库和用户
```sql
-- 连接到PostgreSQL
sudo -u postgres psql

-- 创建数据库
CREATE DATABASE data_asset_platform;

-- 创建用户
CREATE USER sso_user WITH PASSWORD 'your_secure_password';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE data_asset_platform TO sso_user;

-- 退出
\q
```

### 3. 安装反向代理

#### Nginx安装
```bash
# Ubuntu/Debian
sudo apt-get install nginx

# CentOS/RHEL
sudo yum install nginx

# 启动并设置开机自启
sudo systemctl start nginx
sudo systemctl enable nginx
```

## 应用部署

### 1. 获取源代码

```bash
# 克隆代码仓库
git clone <repository-url>
cd data-asset-platform

# 或者从发布包部署
wget <release-package-url>
tar -xzf data-asset-platform-v1.0.0.tar.gz
cd data-asset-platform
```

### 2. 安装依赖

```bash
# 安装应用依赖
npm install

# 安装生产依赖（如果使用）
npm ci --only=production
```

### 3. 环境配置

创建环境配置文件：

```bash
cp .env.example .env
```

编辑`.env`文件，配置以下关键参数：

```env
# 应用基础配置
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret-key

# 数据库配置
DATABASE_URL="postgresql://sso_user:your_secure_password@localhost:5432/data_asset_platform"

# 加密密钥（用于敏感数据加密）
ENCRYPTION_KEY=your-32-character-hex-encryption-key

# 邮件配置（用于告警通知）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# 日志配置
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/sso/app.log

# Redis配置（可选，用于会话存储）
REDIS_URL=redis://localhost:6379

# 安全配置
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=15
```

### 4. 数据库初始化

```bash
# 生成Prisma客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 创建初始管理员用户（可选）
npm run seed
```

### 5. 构建应用

```bash
# 构建生产版本
npm run build

# 验证构建结果
ls -la .next/
```

## Nginx配置

创建Nginx配置文件：

```bash
sudo nano /etc/nginx/sites-available/sso-platform
```

配置内容：

```nginx
upstream sso_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;

    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL证书配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 客户端最大上传大小
    client_max_body_size 10M;

    # 代理到Node.js应用
    location / {
        proxy_pass http://sso_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # 静态文件缓存
    location /_next/static/ {
        proxy_pass http://sso_backend;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }

    # 健康检查端点
    location /health {
        proxy_pass http://sso_backend;
        access_log off;
    }
}
```

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/sso-platform /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载Nginx
sudo systemctl reload nginx
```

## 进程管理

### 使用PM2管理Node.js进程

```bash
# 全局安装PM2
npm install -g pm2

# 创建PM2配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'sso-platform',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/var/log/sso/combined.log',
    out_file: '/var/log/sso/out.log',
    error_file: '/var/log/sso/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
}
EOF

# 启动应用
pm2 start ecosystem.config.js

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup
```

### 使用systemd服务

创建systemd服务文件：

```bash
sudo nano /etc/systemd/system/sso-platform.service
```

服务配置：

```ini
[Unit]
Description=SSO Platform Node.js Application
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/sso-platform
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sso-platform

# 安全配置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/sso-platform /var/log/sso

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
# 重载systemd配置
sudo systemctl daemon-reload

# 启用并启动服务
sudo systemctl enable sso-platform
sudo systemctl start sso-platform

# 检查服务状态
sudo systemctl status sso-platform
```

## SSL证书配置

### 使用Let's Encrypt免费证书

```bash
# 安装Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 设置自动续期
sudo crontab -e
# 添加以下行：
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 使用自签名证书（仅用于测试）

```bash
# 创建证书目录
sudo mkdir -p /etc/ssl/sso

# 生成私钥
sudo openssl genrsa -out /etc/ssl/sso/private.key 2048

# 生成证书
sudo openssl req -new -x509 -key /etc/ssl/sso/private.key -out /etc/ssl/sso/certificate.crt -days 365 -subj "/C=CN/ST=Beijing/L=Beijing/O=Company/CN=your-domain.com"

# 设置权限
sudo chmod 600 /etc/ssl/sso/private.key
sudo chmod 644 /etc/ssl/sso/certificate.crt
```

## 监控和日志

### 1. 日志配置

创建日志目录：

```bash
sudo mkdir -p /var/log/sso
sudo chown www-data:www-data /var/log/sso
sudo chmod 755 /var/log/sso
```

配置日志轮转：

```bash
sudo nano /etc/logrotate.d/sso-platform
```

轮转配置：

```
/var/log/sso/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload sso-platform
    endscript
}
```

### 2. 监控配置

安装监控工具：

```bash
# 安装htop
sudo apt-get install htop

# 安装netstat
sudo apt-get install net-tools

# 设置基础监控脚本
cat > /opt/sso-platform/monitor.sh << 'EOF'
#!/bin/bash

# 检查应用进程
if ! pgrep -f "node.*server.js" > /dev/null; then
    echo "$(date): SSO application is not running" >> /var/log/sso/monitor.log
    systemctl restart sso-platform
fi

# 检查数据库连接
if ! pg_isready -h localhost -p 5432 > /dev/null; then
    echo "$(date): Database is not accessible" >> /var/log/sso/monitor.log
fi

# 检查磁盘空间
DISK_USAGE=$(df /opt/sso-platform | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Disk usage is above 80%: ${DISK_USAGE}%" >> /var/log/sso/monitor.log
fi
EOF

chmod +x /opt/sso-platform/monitor.sh

# 添加到crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/sso-platform/monitor.sh") | crontab -
```

## 安全配置

### 1. 防火墙设置

```bash
# Ubuntu UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# CentOS firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 2. 数据库安全

```bash
# PostgreSQL安全配置
sudo nano /etc/postgresql/13/main/postgresql.conf
```

关键配置：

```
# 只监听本地连接
listen_addresses = 'localhost'

# 启用SSL
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'

# 设置日志
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'all'
```

配置访问控制：

```bash
sudo nano /etc/postgresql/13/main/pg_hba.conf
```

```
# 只允许本地连接
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

### 3. 应用安全

在应用中配置安全中间件：

```javascript
// 在server.js中添加安全配置
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 安全头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// 限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP最多100次请求
  message: '请求过于频繁，请稍后重试'
});

app.use('/api/', limiter);
```

## 备份策略

### 1. 数据库备份

创建备份脚本：

```bash
cat > /opt/sso-platform/backup-db.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/backups/sso"
DB_NAME="data_asset_platform"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 数据库备份
pg_dump -h localhost -U sso_user -d $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# 清理30天前的备份
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

echo "Database backup completed: db_backup_$DATE.sql.gz"
EOF

chmod +x /opt/sso-platform/backup-db.sh

# 设置每日自动备份
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/sso-platform/backup-db.sh") | crontab -
```

### 2. 应用备份

```bash
cat > /opt/sso-platform/backup-app.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/backups/sso"
APP_DIR="/opt/sso-platform"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份应用文件（排除node_modules和日志）
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='.git' \
    -C /opt sso-platform

# 清理30天前的备份
find $BACKUP_DIR -name "app_backup_*.tar.gz" -mtime +30 -delete

echo "Application backup completed: app_backup_$DATE.tar.gz"
EOF

chmod +x /opt/sso-platform/backup-app.sh
```

## 部署验证

### 1. 健康检查

```bash
# 检查应用是否运行
curl -f http://localhost:3000/health

# 检查HTTPS访问
curl -f https://your-domain.com/health

# 检查数据库连接
psql -h localhost -U sso_user -d data_asset_platform -c "SELECT 1;"
```

### 2. 功能测试

```bash
# 测试API端点
curl -X GET https://your-domain.com/api/admin/sso/providers \
     -H "Authorization: Bearer your-admin-token"

# 测试SSO登录流程
# 需要通过浏览器测试实际的SSO流程
```

### 3. 性能测试

```bash
# 安装压测工具
npm install -g artillery

# 创建压测配置
cat > load-test.yml << 'EOF'
config:
  target: 'https://your-domain.com'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Health check"
    requests:
      - get:
          url: "/health"
EOF

# 执行压测
artillery run load-test.yml
```

## 高可用部署

### 1. 负载均衡

使用多个应用实例和负载均衡器：

```nginx
upstream sso_backend {
    server 127.0.0.1:3000 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

### 2. 数据库主从复制

配置PostgreSQL主从复制以提高可用性和读取性能。

### 3. Redis会话存储

使用Redis存储会话信息，确保多实例间的会话共享：

```env
# .env配置
REDIS_URL=redis://localhost:6379
SESSION_STORE=redis
```

## 更新和维护

### 1. 应用更新

```bash
# 创建更新脚本
cat > /opt/sso-platform/update.sh << 'EOF'
#!/bin/bash

set -e

echo "Starting application update..."

# 备份当前版本
./backup-app.sh

# 停止应用
systemctl stop sso-platform

# 拉取最新代码
git pull origin main

# 安装新依赖
npm ci --only=production

# 运行数据库迁移
npx prisma migrate deploy

# 重新构建应用
npm run build

# 启动应用
systemctl start sso-platform

# 验证更新
sleep 10
curl -f http://localhost:3000/health

echo "Application update completed successfully"
EOF

chmod +x /opt/sso-platform/update.sh
```

### 2. 定期维护

```bash
# 创建维护脚本
cat > /opt/sso-platform/maintenance.sh << 'EOF'
#!/bin/bash

echo "Starting maintenance tasks..."

# 清理旧日志
find /var/log/sso -name "*.log" -mtime +30 -delete

# 清理旧的SSO日志记录
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 90);
prisma.sSOLog.deleteMany({
  where: { createdAt: { lt: cutoffDate } }
}).then(result => {
  console.log(\`Cleaned up \${result.count} old log entries\`);
  prisma.\$disconnect();
});
"

# 数据库维护
psql -h localhost -U sso_user -d data_asset_platform -c "VACUUM ANALYZE;"

echo "Maintenance tasks completed"
EOF

chmod +x /opt/sso-platform/maintenance.sh

# 设置每周维护
(crontab -l 2>/dev/null; echo "0 3 * * 0 /opt/sso-platform/maintenance.sh") | crontab -
```

## 故障排除

### 常见问题和解决方案

1. **应用无法启动**
   - 检查端口占用：`netstat -tlnp | grep 3000`
   - 检查环境变量：`printenv | grep NODE_ENV`
   - 查看错误日志：`journalctl -u sso-platform -f`

2. **数据库连接失败**
   - 检查数据库状态：`systemctl status postgresql`
   - 测试连接：`pg_isready -h localhost -p 5432`
   - 检查连接字符串：验证DATABASE_URL格式

3. **SSL证书问题**
   - 检查证书有效性：`openssl x509 -in certificate.crt -text -noout`
   - 验证证书链：`openssl verify -CAfile ca-bundle.crt certificate.crt`
   - 测试SSL连接：`openssl s_client -connect your-domain.com:443`

4. **性能问题**
   - 检查系统资源：`htop`, `df -h`, `free -m`
   - 分析慢查询：检查数据库慢查询日志
   - 查看应用日志：检查响应时间和错误信息

详细的故障排除指南请参考[故障排除手册](./sso-troubleshooting-guide.md)。

## 联系支持

如需技术支持，请联系：
- 邮箱：support@company.com
- 文档：https://docs.company.com/sso
- 问题跟踪：https://github.com/company/sso-platform/issues