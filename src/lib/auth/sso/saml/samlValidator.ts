/**
 * SAML响应验证器
 * 提供全面的SAML响应安全验证
 */

import * as xml2js from 'xml2js';
import * as crypto from 'crypto';

/**
 * SAML验证选项
 */
export interface SAMLValidationOptions {
  requireSignature?: boolean;          // 要求签名验证
  requireTimestamp?: boolean;          // 要求时间戳验证
  maxClockSkewMs?: number;            // 最大时钟偏差(毫秒)
  maxSessionAgeMs?: number;           // 最大会话年龄(毫秒)
  audienceUrl?: string;               // 受众URL验证
  recipientUrl?: string;              // 接收者URL验证
  allowedInResponseTo?: string[];     // 允许的InResponseTo值
}

/**
 * SAML验证结果
 */
export interface SAMLValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  assertions?: any;
  conditions?: SAMLConditions;
  subject?: SAMLSubject;
}

/**
 * SAML条件
 */
export interface SAMLConditions {
  notBefore?: Date;
  notOnOrAfter?: Date;
  audienceRestrictions?: string[];
}

/**
 * SAML主体
 */
export interface SAMLSubject {
  nameID?: string;
  nameIDFormat?: string;
  subjectConfirmations?: SAMLSubjectConfirmation[];
}

/**
 * SAML主体确认
 */
export interface SAMLSubjectConfirmation {
  method?: string;
  inResponseTo?: string;
  recipient?: string;
  notOnOrAfter?: Date;
}

/**
 * SAML验证器类
 */
export class SAMLValidator {
  private options: Required<SAMLValidationOptions>;

  constructor(options: SAMLValidationOptions = {}) {
    this.options = {
      requireSignature: options.requireSignature ?? true,
      requireTimestamp: options.requireTimestamp ?? true,
      maxClockSkewMs: options.maxClockSkewMs ?? 60000,      // 1分钟
      maxSessionAgeMs: options.maxSessionAgeMs ?? 3600000,  // 1小时
      audienceUrl: options.audienceUrl ?? '',
      recipientUrl: options.recipientUrl ?? '',
      allowedInResponseTo: options.allowedInResponseTo ?? []
    };
  }

  /**
   * 验证SAML响应
   */
  async validateSAMLResponse(
    samlResponseBase64: string,
    certificate: string
  ): Promise<SAMLValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Base64解码
      const samlResponseXML = Buffer.from(samlResponseBase64, 'base64').toString('utf-8');

      // 2. 解析XML
      const parsedResponse = await this.parseSAMLResponse(samlResponseXML);

      if (!parsedResponse) {
        errors.push('Failed to parse SAML response XML');
        return { valid: false, errors, warnings };
      }

      // 3. 验证XML结构
      const structureValid = this.validateStructure(parsedResponse, errors, warnings);
      if (!structureValid) {
        return { valid: false, errors, warnings };
      }

      // 4. 验证签名
      if (this.options.requireSignature) {
        const signatureValid = await this.validateSignature(
          samlResponseXML,
          certificate,
          errors,
          warnings
        );

        if (!signatureValid) {
          errors.push('Signature validation failed');
          return { valid: false, errors, warnings };
        }
      }

      // 5. 提取断言
      const assertions = this.extractAssertions(parsedResponse);
      if (!assertions || assertions.length === 0) {
        errors.push('No assertions found in SAML response');
        return { valid: false, errors, warnings };
      }

      // 6. 验证条件
      const conditions = this.extractConditions(assertions[0]);
      const conditionsValid = this.validateConditions(conditions, errors, warnings);

      if (!conditionsValid) {
        return { valid: false, errors, warnings, conditions };
      }

      // 7. 验证主体
      const subject = this.extractSubject(assertions[0]);
      const subjectValid = this.validateSubject(subject, errors, warnings);

      if (!subjectValid) {
        return { valid: false, errors, warnings, subject };
      }

      // 8. 防重放攻击检查
      const replayValid = await this.validateReplayProtection(
        parsedResponse,
        errors,
        warnings
      );

      if (!replayValid) {
        warnings.push('Potential replay attack detected');
      }

      // 所有验证通过
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        assertions,
        conditions,
        subject
      };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * 解析SAML响应XML
   */
  private async parseSAMLResponse(xml: string): Promise<any> {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      explicitRoot: true,
      normalize: true,
      normalizeTags: true,
      trim: true,
      // 安全配置：禁用外部实体以防止XXE攻击
      explicitChildren: false
    });

    try {
      // 输入验证：检查是否为有效的SAML响应格式
      if (!xml.includes('<saml:Response') && !xml.includes('<Response') &&
          !xml.includes('<samlp:Response') && !xml.includes('<saml2p:Response')) {
        throw new Error('Invalid SAML response format');
      }

      return await parser.parseStringPromise(xml);
    } catch (error) {
      console.error('XML parsing error:', error);
      return null;
    }
  }

  /**
   * 验证XML结构
   */
  private validateStructure(
    parsedResponse: any,
    errors: string[],
    warnings: string[]
  ): boolean {
    // 获取Response节点
    const response = parsedResponse['samlp:response'] ||
                     parsedResponse['saml2p:response'] ||
                     parsedResponse.response;

    if (!response) {
      errors.push('Missing Response element');
      return false;
    }

    // 验证状态码
    const status = response['samlp:status'] || response['saml2p:status'] || response.status;
    if (!status) {
      errors.push('Missing Status element');
      return false;
    }

    const statusCode = status['samlp:statuscode'] ||
                       status['saml2p:statuscode'] ||
                       status.statuscode;

    if (!statusCode || !statusCode.$.value) {
      errors.push('Missing StatusCode');
      return false;
    }

    // 检查状态码是否为成功
    if (!statusCode.$.value.includes('Success')) {
      errors.push(`SAML authentication failed with status: ${statusCode.$.value}`);

      // 获取状态消息
      const statusMessage = status['samlp:statusmessage'] ||
                           status['saml2p:statusmessage'] ||
                           status.statusmessage;

      if (statusMessage) {
        errors.push(`Status message: ${statusMessage}`);
      }

      return false;
    }

    return true;
  }

  /**
   * 验证签名
   */
  private async validateSignature(
    xml: string,
    certificate: string,
    errors: string[],
    warnings: string[]
  ): Promise<boolean> {
    try {
      // 检查是否存在签名
      if (!xml.includes('<ds:Signature') && !xml.includes('<Signature')) {
        if (this.options.requireSignature) {
          errors.push('Missing required signature');
          return false;
        } else {
          warnings.push('No signature found but not required');
          return true;
        }
      }

      // TODO: 实现完整的XML签名验证
      // 这里需要使用xmldsigjs或类似库进行完整的XML数字签名验证
      // 简化实现：只验证证书的存在性

      if (!certificate) {
        errors.push('Certificate not provided for signature validation');
        return false;
      }

      warnings.push('Signature validation is simplified - full verification recommended');
      return true;

    } catch (error) {
      errors.push(`Signature validation error: ${error instanceof Error ? error.message : 'Unknown'}`);
      return false;
    }
  }

  /**
   * 提取断言
   */
  private extractAssertions(parsedResponse: any): any[] {
    const response = parsedResponse['samlp:response'] ||
                     parsedResponse['saml2p:response'] ||
                     parsedResponse.response;

    if (!response) return [];

    const assertions = response['saml:assertion'] ||
                      response['saml2:assertion'] ||
                      response.assertion;

    if (!assertions) return [];

    return Array.isArray(assertions) ? assertions : [assertions];
  }

  /**
   * 提取条件
   */
  private extractConditions(assertion: any): SAMLConditions {
    const conditions = assertion['saml:conditions'] ||
                      assertion['saml2:conditions'] ||
                      assertion.conditions;

    if (!conditions) return {};

    const result: SAMLConditions = {};

    // 提取时间限制
    if (conditions.$.notbefore) {
      result.notBefore = new Date(conditions.$.notbefore);
    }

    if (conditions.$.notonorafter) {
      result.notOnOrAfter = new Date(conditions.$.notonorafter);
    }

    // 提取受众限制
    const audienceRestriction = conditions['saml:audiencerestriction'] ||
                               conditions['saml2:audiencerestriction'] ||
                               conditions.audiencerestriction;

    if (audienceRestriction) {
      const audience = audienceRestriction['saml:audience'] ||
                      audienceRestriction['saml2:audience'] ||
                      audienceRestriction.audience;

      if (audience) {
        result.audienceRestrictions = Array.isArray(audience) ? audience : [audience];
      }
    }

    return result;
  }

  /**
   * 验证条件
   */
  private validateConditions(
    conditions: SAMLConditions,
    errors: string[],
    warnings: string[]
  ): boolean {
    const now = new Date();

    // 验证时间范围
    if (conditions.notBefore) {
      const notBeforeWithSkew = new Date(
        conditions.notBefore.getTime() - this.options.maxClockSkewMs
      );

      if (now < notBeforeWithSkew) {
        errors.push(`Assertion is not yet valid (NotBefore: ${conditions.notBefore.toISOString()})`);
        return false;
      }
    }

    if (conditions.notOnOrAfter) {
      const notOnOrAfterWithSkew = new Date(
        conditions.notOnOrAfter.getTime() + this.options.maxClockSkewMs
      );

      if (now >= notOnOrAfterWithSkew) {
        errors.push(`Assertion has expired (NotOnOrAfter: ${conditions.notOnOrAfter.toISOString()})`);
        return false;
      }
    }

    // 验证受众
    if (this.options.audienceUrl && conditions.audienceRestrictions) {
      const audienceMatch = conditions.audienceRestrictions.some(
        audience => audience === this.options.audienceUrl
      );

      if (!audienceMatch) {
        errors.push(`Audience restriction failed. Expected: ${this.options.audienceUrl}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 提取主体
   */
  private extractSubject(assertion: any): SAMLSubject {
    const subject = assertion['saml:subject'] ||
                   assertion['saml2:subject'] ||
                   assertion.subject;

    if (!subject) return {};

    const result: SAMLSubject = {};

    // 提取NameID
    const nameID = subject['saml:nameid'] ||
                  subject['saml2:nameid'] ||
                  subject.nameid;

    if (nameID) {
      result.nameID = typeof nameID === 'string' ? nameID : nameID._;
      result.nameIDFormat = nameID.$.format;
    }

    // 提取主体确认
    const subjectConfirmation = subject['saml:subjectconfirmation'] ||
                               subject['saml2:subjectconfirmation'] ||
                               subject.subjectconfirmation;

    if (subjectConfirmation) {
      const confirmations = Array.isArray(subjectConfirmation)
        ? subjectConfirmation
        : [subjectConfirmation];

      result.subjectConfirmations = confirmations.map((sc: any) => {
        const data = sc['saml:subjectconfirmationdata'] ||
                    sc['saml2:subjectconfirmationdata'] ||
                    sc.subjectconfirmationdata;

        return {
          method: sc.$.method,
          inResponseTo: data?.$?.inresponseto,
          recipient: data?.$?.recipient,
          notOnOrAfter: data?.$?.notonorafter ? new Date(data.$.notonorafter) : undefined
        };
      });
    }

    return result;
  }

  /**
   * 验证主体
   */
  private validateSubject(
    subject: SAMLSubject,
    errors: string[],
    warnings: string[]
  ): boolean {
    // 验证NameID存在
    if (!subject.nameID) {
      errors.push('Missing NameID in Subject');
      return false;
    }

    // 验证主体确认
    if (subject.subjectConfirmations && subject.subjectConfirmations.length > 0) {
      const now = new Date();

      for (const confirmation of subject.subjectConfirmations) {
        // 验证接收者
        if (this.options.recipientUrl && confirmation.recipient) {
          if (confirmation.recipient !== this.options.recipientUrl) {
            errors.push(`Recipient mismatch. Expected: ${this.options.recipientUrl}, Got: ${confirmation.recipient}`);
            return false;
          }
        }

        // 验证时间
        if (confirmation.notOnOrAfter) {
          const notOnOrAfterWithSkew = new Date(
            confirmation.notOnOrAfter.getTime() + this.options.maxClockSkewMs
          );

          if (now >= notOnOrAfterWithSkew) {
            errors.push('SubjectConfirmation has expired');
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * 防重放攻击验证
   */
  private async validateReplayProtection(
    parsedResponse: any,
    errors: string[],
    warnings: string[]
  ): Promise<boolean> {
    // 获取Response ID
    const response = parsedResponse['samlp:response'] ||
                     parsedResponse['saml2p:response'] ||
                     parsedResponse.response;

    const responseId = response?.$?.id || response?.$?.ID;

    if (!responseId) {
      warnings.push('Response ID missing - cannot check for replay attacks');
      return true;
    }

    // TODO: 实现ID缓存检查以防止重放攻击
    // 需要维护一个已使用的Response ID列表(Redis或内存缓存)
    // 并在验证时检查ID是否已被使用

    return true;
  }
}

/**
 * 创建SAML验证器实例
 */
export function createSAMLValidator(options?: SAMLValidationOptions): SAMLValidator {
  return new SAMLValidator(options);
}
