/**
 * SAML元数据生成和管理模块
 * 负责生成和解析SAML元数据文档
 */

import { prisma } from '@/lib/prisma';

/**
 * SAML元数据配置
 */
export interface SAMLMetadataConfig {
  entityId: string;
  acsUrl: string;
  sloUrl?: string;
  certificate?: string;
  wantAssertionsSigned?: boolean;
  nameIdFormat?: string[];
  organizationName?: string;
  organizationDisplayName?: string;
  organizationURL?: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
}

/**
 * IdP元数据信息
 */
export interface IdPMetadata {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  nameIdFormats?: string[];
}

/**
 * SAML元数据服务
 */
export class SAMLMetadataService {
  /**
   * 生成SP元数据XML
   */
  static generateSPMetadata(config: SAMLMetadataConfig): string {
    const {
      entityId,
      acsUrl,
      sloUrl,
      certificate,
      wantAssertionsSigned = true,
      nameIdFormat = [
        'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        'urn:oasis:names:tc:SAML:2.0:nameid-format:transient'
      ],
      organizationName = '数据资产管理平台',
      organizationDisplayName = '数据资产管理平台',
      organizationURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      contactPersonName = 'Administrator',
      contactPersonEmail = 'admin@example.com'
    } = config;

    // 格式化证书 (移除BEGIN/END标记和换行符)
    const formatCertificate = (cert?: string): string => {
      if (!cert) return '';
      return cert
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\n/g, '')
        .replace(/\r/g, '')
        .trim();
    };

    const formattedCert = formatCertificate(certificate);

    // 构建元数据XML
    const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                     entityID="${this.escapeXML(entityId)}"
                     validUntil="${this.getValidUntil()}">

  <md:SPSSODescriptor
    AuthnRequestsSigned="true"
    WantAssertionsSigned="${wantAssertionsSigned}"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">

    ${formattedCert ? `<md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${formattedCert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>

    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${formattedCert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>` : ''}

    ${sloUrl ? `<md:SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${this.escapeXML(sloUrl)}" />

    <md:SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${this.escapeXML(sloUrl)}" />` : ''}

    ${nameIdFormat.map(format =>
      `<md:NameIDFormat>${this.escapeXML(format)}</md:NameIDFormat>`
    ).join('\n    ')}

    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${this.escapeXML(acsUrl)}"
      index="0"
      isDefault="true" />

    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${this.escapeXML(acsUrl)}"
      index="1" />

    <md:AttributeConsumingService index="0" isDefault="true">
      <md:ServiceName xml:lang="zh-CN">数据资产管理平台</md:ServiceName>
      <md:ServiceName xml:lang="en">Data Asset Management Platform</md:ServiceName>

      <md:RequestedAttribute Name="email" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" isRequired="true"/>
      <md:RequestedAttribute Name="name" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" isRequired="false"/>
      <md:RequestedAttribute Name="firstName" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" isRequired="false"/>
      <md:RequestedAttribute Name="lastName" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" isRequired="false"/>
      <md:RequestedAttribute Name="department" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" isRequired="false"/>
      <md:RequestedAttribute Name="position" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" isRequired="false"/>
    </md:AttributeConsumingService>
  </md:SPSSODescriptor>

  <md:Organization>
    <md:OrganizationName xml:lang="zh-CN">${this.escapeXML(organizationName)}</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="zh-CN">${this.escapeXML(organizationDisplayName)}</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="zh-CN">${this.escapeXML(organizationURL)}</md:OrganizationURL>
  </md:Organization>

  <md:ContactPerson contactType="technical">
    <md:GivenName>${this.escapeXML(contactPersonName)}</md:GivenName>
    <md:EmailAddress>${this.escapeXML(contactPersonEmail)}</md:EmailAddress>
  </md:ContactPerson>

  <md:ContactPerson contactType="support">
    <md:GivenName>${this.escapeXML(contactPersonName)}</md:GivenName>
    <md:EmailAddress>${this.escapeXML(contactPersonEmail)}</md:EmailAddress>
  </md:ContactPerson>
</md:EntityDescriptor>`;

    return metadata;
  }

  /**
   * 解析IdP元数据
   */
  static async parseIdPMetadata(metadataXML: string): Promise<IdPMetadata> {
    try {
      // 使用xml2js解析器 (需要导入)
      const xml2js = require('xml2js');
      const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: false,
        explicitRoot: true,
        normalize: true,
        normalizeTags: true,
        trim: true
      });

      const result = await parser.parseStringPromise(metadataXML);

      // 提取EntityDescriptor
      const entityDescriptor = result['md:entitydescriptor'] || result.entitydescriptor;
      if (!entityDescriptor) {
        throw new Error('Invalid IdP metadata: Missing EntityDescriptor');
      }

      const entityId = entityDescriptor.$.entityid || entityDescriptor.$.entityID;

      // 提取IDPSSODescriptor
      const idpDescriptor = entityDescriptor['md:idpssodescriptor'] || entityDescriptor.idpssodescriptor;
      if (!idpDescriptor) {
        throw new Error('Invalid IdP metadata: Missing IDPSSODescriptor');
      }

      // 提取SSO URL
      const ssoService = Array.isArray(idpDescriptor['md:singlesignonservice'])
        ? idpDescriptor['md:singlesignonservice'][0]
        : idpDescriptor['md:singlesignonservice'] || idpDescriptor.singlesignonservice;

      const ssoUrl = ssoService?.$.location || ssoService?.$.Location;

      // 提取SLO URL (可选)
      const sloService = Array.isArray(idpDescriptor['md:singlelogoutservice'])
        ? idpDescriptor['md:singlelogoutservice'][0]
        : idpDescriptor['md:singlelogoutservice'] || idpDescriptor.singlelogoutservice;

      const sloUrl = sloService?.$.location || sloService?.$.Location;

      // 提取证书
      const keyDescriptor = Array.isArray(idpDescriptor['md:keydescriptor'])
        ? idpDescriptor['md:keydescriptor'].find((kd: any) => kd.$.use === 'signing' || !kd.$.use)
        : idpDescriptor['md:keydescriptor'] || idpDescriptor.keydescriptor;

      let certificate = '';
      if (keyDescriptor) {
        const keyInfo = keyDescriptor['ds:keyinfo'] || keyDescriptor.keyinfo;
        const x509Data = keyInfo?.['ds:x509data'] || keyInfo?.x509data;
        const x509Cert = x509Data?.['ds:x509certificate'] || x509Data?.x509certificate;
        certificate = x509Cert?._ || x509Cert || '';
      }

      // 提取NameID格式
      let nameIdFormats: string[] = [];
      const nameIdFormat = idpDescriptor['md:nameidformat'] || idpDescriptor.nameidformat;
      if (nameIdFormat) {
        nameIdFormats = Array.isArray(nameIdFormat) ? nameIdFormat : [nameIdFormat];
      }

      return {
        entityId,
        ssoUrl,
        sloUrl,
        certificate: certificate.replace(/\s+/g, ''),
        nameIdFormats
      };

    } catch (error) {
      console.error('Failed to parse IdP metadata:', error);
      throw new Error('Invalid IdP metadata XML');
    }
  }

  /**
   * 从数据库加载提供商并生成元数据
   */
  static async generateSPMetadataFromProvider(providerId: string): Promise<string> {
    const provider = await prisma.sSOProvider.findUnique({
      where: { id: providerId }
    });

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const config: SAMLMetadataConfig = {
      entityId: provider.entityId || `${baseUrl}/saml/metadata`,
      acsUrl: `${baseUrl}/api/auth/sso/saml/acs`,
      sloUrl: provider.sloUrl ? `${baseUrl}/api/auth/sso/saml/slo` : undefined,
      certificate: provider.certificateData || undefined,
      wantAssertionsSigned: true
    };

    return this.generateSPMetadata(config);
  }

  /**
   * 验证IdP元数据并保存到数据库
   */
  static async validateAndSaveIdPMetadata(
    providerId: string,
    metadataXML: string
  ): Promise<void> {
    // 解析元数据
    const metadata = await this.parseIdPMetadata(metadataXML);

    // 验证必需字段
    if (!metadata.entityId || !metadata.ssoUrl || !metadata.certificate) {
      throw new Error('IdP metadata is missing required fields');
    }

    // 更新数据库
    await prisma.sSOProvider.update({
      where: { id: providerId },
      data: {
        entityId: metadata.entityId,
        ssoUrl: metadata.ssoUrl,
        sloUrl: metadata.sloUrl,
        certificateData: metadata.certificate,
        updatedAt: new Date()
      }
    });
  }

  /**
   * XML特殊字符转义
   */
  private static escapeXML(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 生成元数据有效期 (1年)
   */
  private static getValidUntil(): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString();
  }
}
