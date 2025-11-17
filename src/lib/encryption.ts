import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const ENCODING = 'base64'

/**
 * 获取加密密钥
 * 从环境变量获取，如果没有则生成一个临时密钥（仅用于开发）
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    console.warn('ENCRYPTION_KEY not found in environment variables. Using temporary key for development.')
    // 生成临时密钥用于开发环境
    return crypto.randomBytes(32).toString('hex')
  }
  return key
}

/**
 * 加密敏感数据
 */
export function encrypt(text: string): string {
  if (!text) return ''

  try {
    const key = Buffer.from(getEncryptionKey(), 'hex')
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(ALGORITHM, key)

    cipher.setAAD(Buffer.from('sso-config', 'utf8'))

    let encrypted = cipher.update(text, 'utf8', ENCODING)
    encrypted += cipher.final(ENCODING)

    const authTag = cipher.getAuthTag()

    // 组合 IV、认证标签和加密数据
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, ENCODING)
    ])

    return combined.toString(ENCODING)
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * 解密敏感数据
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return ''

  try {
    const key = Buffer.from(getEncryptionKey(), 'hex')
    const combined = Buffer.from(encryptedData, ENCODING)

    // 提取 IV (前16字节)、认证标签(16字节) 和加密数据
    const iv = combined.subarray(0, 16)
    const authTag = combined.subarray(16, 32)
    const encrypted = combined.subarray(32).toString(ENCODING)

    const decipher = crypto.createDecipher(ALGORITHM, key)
    decipher.setAAD(Buffer.from('sso-config', 'utf8'))
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, ENCODING, 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * 验证证书格式
 */
export function validateCertificate(certificate: string): boolean {
  if (!certificate) return false

  const cleanCert = certificate.trim()
  return cleanCert.includes('-----BEGIN CERTIFICATE-----') &&
         cleanCert.includes('-----END CERTIFICATE-----')
}

/**
 * 验证私钥格式
 */
export function validatePrivateKey(privateKey: string): boolean {
  if (!privateKey) return false

  const cleanKey = privateKey.trim()
  return (cleanKey.includes('-----BEGIN PRIVATE KEY-----') &&
          cleanKey.includes('-----END PRIVATE KEY-----')) ||
         (cleanKey.includes('-----BEGIN RSA PRIVATE KEY-----') &&
          cleanKey.includes('-----END RSA PRIVATE KEY-----'))
}

/**
 * 生成密钥对（用于测试）
 */
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })

  return { publicKey, privateKey }
}

/**
 * 验证URL格式
 */
export function validateUrl(url: string): boolean {
  if (!url) return false

  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 生成安全的随机密钥
 */
export function generateSecureKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}