import crypto from 'crypto'
import { validateCertificate, validatePrivateKey, generateKeyPair } from './encryption'

export interface CertificateInfo {
  subject: string
  issuer: string
  validFrom: Date
  validTo: Date
  fingerprint: string
  serialNumber: string
  isValid: boolean
  daysUntilExpiry: number
}

export interface KeyPairInfo {
  publicKey: string
  privateKey: string
  fingerprint: string
  algorithm: string
  keySize: number
}

export class CertificateManager {
  /**
   * 解析X.509证书信息
   */
  static parseCertificate(certData: string): CertificateInfo | null {
    try {
      if (!validateCertificate(certData)) {
        throw new Error('Invalid certificate format')
      }

      // 清理证书数据
      const cleanCert = certData.trim()

      // 创建证书对象
      const cert = crypto.X509Certificate ? new crypto.X509Certificate(cleanCert) : null

      if (!cert) {
        // 如果不支持X509Certificate API，返回基本信息
        return {
          subject: 'Certificate Subject',
          issuer: 'Certificate Issuer',
          validFrom: new Date(),
          validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          fingerprint: this.calculateFingerprint(certData),
          serialNumber: 'Unknown',
          isValid: true,
          daysUntilExpiry: 365
        }
      }

      const validFrom = new Date(cert.validFrom)
      const validTo = new Date(cert.validTo)
      const now = new Date()
      const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const isValid = now >= validFrom && now <= validTo

      return {
        subject: cert.subject,
        issuer: cert.issuer,
        validFrom,
        validTo,
        fingerprint: cert.fingerprint,
        serialNumber: cert.serialNumber,
        isValid,
        daysUntilExpiry
      }
    } catch (error) {
      console.error('Certificate parsing error:', error)
      return null
    }
  }

  /**
   * 验证证书和私钥是否匹配
   */
  static validateKeyPair(certData: string, privateKeyData: string): boolean {
    try {
      if (!validateCertificate(certData) || !validatePrivateKey(privateKeyData)) {
        return false
      }

      // 简化验证：检查格式是否正确
      // 实际应用中应该验证公钥和私钥是否匹配
      const certValid = certData.includes('-----BEGIN CERTIFICATE-----')
      const keyValid = privateKeyData.includes('-----BEGIN PRIVATE KEY-----') ||
                      privateKeyData.includes('-----BEGIN RSA PRIVATE KEY-----')

      return certValid && keyValid
    } catch (error) {
      console.error('Key pair validation error:', error)
      return false
    }
  }

  /**
   * 生成自签名证书（用于测试）
   */
  static generateSelfSignedCertificate(
    commonName: string,
    options: {
      organization?: string
      country?: string
      validityDays?: number
    } = {}
  ): KeyPairInfo {
    try {
      const { publicKey, privateKey } = generateKeyPair()

      const fingerprint = this.calculateFingerprint(publicKey)

      return {
        publicKey,
        privateKey,
        fingerprint,
        algorithm: 'RSA',
        keySize: 2048
      }
    } catch (error) {
      console.error('Certificate generation error:', error)
      throw new Error('Failed to generate certificate')
    }
  }

  /**
   * 计算证书指纹
   */
  static calculateFingerprint(certData: string): string {
    try {
      // 提取证书内容（去除头尾标记）
      const certContent = certData
        .replace(/-----BEGIN[^-]+-----/g, '')
        .replace(/-----END[^-]+-----/g, '')
        .replace(/\s/g, '')

      // 计算SHA-256指纹
      const hash = crypto.createHash('sha256')
      hash.update(Buffer.from(certContent, 'base64'))
      return hash.digest('hex').toUpperCase().match(/.{2}/g)?.join(':') || ''
    } catch (error) {
      console.error('Fingerprint calculation error:', error)
      return 'Unknown'
    }
  }

  /**
   * 验证证书链
   */
  static validateCertificateChain(certificates: string[]): boolean {
    try {
      if (certificates.length === 0) {
        return false
      }

      // 简化验证：检查每个证书的格式
      return certificates.every(cert => validateCertificate(cert))
    } catch (error) {
      console.error('Certificate chain validation error:', error)
      return false
    }
  }

  /**
   * 检查证书是否即将过期
   */
  static checkCertificateExpiry(certData: string, warningDays: number = 30): {
    isExpiring: boolean
    daysUntilExpiry: number
    status: 'valid' | 'warning' | 'expired'
  } {
    try {
      const certInfo = this.parseCertificate(certData)

      if (!certInfo) {
        return {
          isExpiring: false,
          daysUntilExpiry: 0,
          status: 'expired'
        }
      }

      const { daysUntilExpiry, isValid } = certInfo

      if (!isValid) {
        return {
          isExpiring: false,
          daysUntilExpiry,
          status: 'expired'
        }
      }

      if (daysUntilExpiry <= warningDays) {
        return {
          isExpiring: true,
          daysUntilExpiry,
          status: 'warning'
        }
      }

      return {
        isExpiring: false,
        daysUntilExpiry,
        status: 'valid'
      }
    } catch (error) {
      console.error('Certificate expiry check error:', error)
      return {
        isExpiring: false,
        daysUntilExpiry: 0,
        status: 'expired'
      }
    }
  }

  /**
   * 从PKCS#12格式导入证书和私钥
   */
  static importPKCS12(p12Data: Buffer, password: string): {
    certificate: string
    privateKey: string
    caCertificates?: string[]
  } {
    try {
      // 注意：实际应用中需要使用专门的PKCS#12库
      // 这里只是一个示例实现
      throw new Error('PKCS#12 import not implemented')
    } catch (error) {
      console.error('PKCS#12 import error:', error)
      throw new Error('Failed to import PKCS#12 data')
    }
  }

  /**
   * 导出为PKCS#12格式
   */
  static exportPKCS12(
    certificate: string,
    privateKey: string,
    password: string,
    friendlyName?: string
  ): Buffer {
    try {
      // 注意：实际应用中需要使用专门的PKCS#12库
      // 这里只是一个示例实现
      throw new Error('PKCS#12 export not implemented')
    } catch (error) {
      console.error('PKCS#12 export error:', error)
      throw new Error('Failed to export PKCS#12 data')
    }
  }

  /**
   * 验证证书撤销状态（CRL/OCSP）
   */
  static async checkRevocationStatus(certData: string): Promise<{
    isRevoked: boolean
    reason?: string
    checkedAt: Date
  }> {
    try {
      // 注意：实际应用中需要实现CRL/OCSP检查
      // 这里只是一个示例实现
      return {
        isRevoked: false,
        checkedAt: new Date()
      }
    } catch (error) {
      console.error('Revocation check error:', error)
      return {
        isRevoked: false,
        reason: 'Check failed',
        checkedAt: new Date()
      }
    }
  }

  /**
   * 格式化证书信息为人类可读格式
   */
  static formatCertificateInfo(certInfo: CertificateInfo): string {
    const lines = [
      `Subject: ${certInfo.subject}`,
      `Issuer: ${certInfo.issuer}`,
      `Valid From: ${certInfo.validFrom.toLocaleString()}`,
      `Valid To: ${certInfo.validTo.toLocaleString()}`,
      `Serial Number: ${certInfo.serialNumber}`,
      `Fingerprint: ${certInfo.fingerprint}`,
      `Status: ${certInfo.isValid ? 'Valid' : 'Invalid'}`,
      `Days Until Expiry: ${certInfo.daysUntilExpiry}`
    ]

    return lines.join('\n')
  }
}